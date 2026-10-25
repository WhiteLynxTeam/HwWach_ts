import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomInt } from 'crypto';
import { Invite } from '../entities/requests.entity';
import { Organization } from '../entities/organization.entity';
import { Person, personFullName } from '../entities/person.entity';
import { MEMBER_ROLE_ID, roleIdByCode, RoleCode } from '../common/permissions';
import { AuthUser } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { RateLimitService } from '../core/rate-limit.service';
import { RegistrationsService, hashInviteToken } from '../users/registrations.service';
import { getConfig } from '../config/configuration';

const INVITE_TTL_MS = 7 * 86_400_000;
// без похожих символов: 0/O, 1/I/L
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Приглашения (9.1, вариант «А»): ссылка + короткий код, через мессенджер.
// По приглашению всё равно создаётся заявка — её утверждает админ
@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite) private invites: Repository<Invite>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(Person) private persons: Repository<Person>,
    private regs: RegistrationsService,
    private audit: AuditService,
    private limits: RateLimitService,
  ) {}

  private shortCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    return s;
  }

  private link(token: string): string {
    return `${getConfig().publicUrl}/invite/${token}`;
  }

  private view(i: Invite) {
    return {
      id: i.id,
      code: `${i.shortCode.slice(0, 3)}-${i.shortCode.slice(3)}`,
      personId: i.personId ?? null,
      personName: i.person ? personFullName(i.person) : null,
      role: i.systemRole?.code ?? null,
      roleName: i.systemRole?.name ?? null,
      maxUses: i.maxUses,
      usedCount: i.usedCount,
      expiresAt: i.expiresAt,
      revokedAt: i.revokedAt ?? null,
      createdAt: i.createdAt,
      isActive: !i.revokedAt && i.expiresAt.getTime() > Date.now() && i.usedCount < i.maxUses,
    };
  }

  async create(user: AuthUser, dto: { personId?: string; roleCode?: string; maxUses?: number }, ip: string) {
    if (dto.roleCode === RoleCode.ADMIN) throw new BadRequestException('Администратора пригласить нельзя');
    const roleId = dto.roleCode ? roleIdByCode(dto.roleCode) : MEMBER_ROLE_ID;
    if (!roleId) throw new BadRequestException('Неизвестная роль');
    if (dto.personId) {
      const p = await this.persons.findOne({ where: { id: dto.personId, organizationId: user.org } });
      if (!p || !p.isActive) throw new NotFoundException('Человек не найден');
    }
    const token = randomBytes(24).toString('base64url');
    let saved: Invite | null = null;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      try {
        saved = await this.invites.save(this.invites.create({
          organizationId: user.org,
          tokenHash: hashInviteToken(token),
          shortCode: this.shortCode(),
          personId: dto.personId ?? null,
          systemRoleId: roleId,
          // приглашение из карточки — одноразовое
          maxUses: dto.personId ? 1 : dto.maxUses ?? 1,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          createdByAccountId: user.id,
          createdByPersonId: user.person,
        }));
      } catch {
        // совпал короткий код — пробуем другой
      }
    }
    if (!saved) throw new BadRequestException('Не удалось создать приглашение, повторите');
    await this.audit.log({ org: user.org, user, action: 'invite.create', objectType: 'invite', objectId: saved.id, details: { personId: dto.personId, role: dto.roleCode ?? 'member' }, ip });
    const full = await this.invites.findOneOrFail({ where: { id: saved.id }, relations: ['person', 'systemRole'] });
    const org = await this.orgs.findOneOrFail({ where: { id: user.org } });
    const v = this.view(full);
    return {
      ...v,
      token,
      link: this.link(token),
      // готовый текст для «Поделиться»
      shareText: `Приглашение в «${org.shortName || org.name}» в приложении HwWach.\nСсылка: ${this.link(token)}\nИли код в приложении: ${v.code}`,
    };
  }

  async list(user: AuthUser) {
    const list = await this.invites.find({ where: { organizationId: user.org }, relations: ['person', 'systemRole'], order: { createdAt: 'DESC' }, take: 100 });
    return list.map((i) => this.view(i));
  }

  async revoke(user: AuthUser, id: string, ip: string) {
    const i = await this.invites.findOne({ where: { id, organizationId: user.org } });
    if (!i) throw new NotFoundException('Приглашение не найдено');
    await this.invites.update(i.id, { revokedAt: new Date() });
    await this.audit.log({ org: user.org, user, action: 'invite.revoke', objectType: 'invite', objectId: i.id, ip });
    return { id: i.id, revoked: true };
  }

  // Для экрана регистрации: какая организация и человек за кодом
  async resolve(codeOrToken: string, ip: string) {
    await this.limits.hit(`invite_resolve:${ip}`, 30, 3_600_000, 'Слишком много попыток. Попробуйте через час.');
    const invite = await this.regs.findUsableInvite(codeOrToken);
    const org = await this.orgs.findOneOrFail({ where: { id: invite.organizationId } });
    return {
      organizationId: org.id,
      organizationName: org.shortName || org.name,
      person: invite.person
        ? { lastName: invite.person.lastName, firstName: invite.person.firstName, middleName: invite.person.middleName ?? null, position: invite.person.position ?? null }
        : null,
      expiresAt: invite.expiresAt,
    };
  }

  // Страница по ссылке из мессенджера: код и кнопка «Открыть в приложении»
  async page(token: string): Promise<string> {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    let body: string;
    try {
      const invite = await this.regs.findUsableInvite(token);
      const org = await this.orgs.findOneOrFail({ where: { id: invite.organizationId } });
      const code = `${invite.shortCode.slice(0, 3)}-${invite.shortCode.slice(3)}`;
      body = `<h1>Приглашение в «${esc(org.shortName || org.name)}»</h1>
<p>Установите приложение HwWach и на экране регистрации выберите «У меня есть приглашение».</p>
<p class="code">${esc(code)}</p>
<p><a class="btn" href="hwwach://invite?code=${encodeURIComponent(code)}">Открыть в приложении</a></p>
<p class="muted">Приглашение действует до ${invite.expiresAt.toLocaleDateString('ru-RU')}. После регистрации заявку утвердит администратор.</p>`;
    } catch {
      body = '<h1>Приглашение недействительно</h1><p>Срок истёк или его отозвали. Попросите у администратора новое.</p>';
    }
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HwWach — приглашение</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#1f2937}
.code{font-size:32px;font-weight:700;letter-spacing:4px;text-align:center;background:#f3f4f6;border-radius:12px;padding:16px}
.btn{display:block;text-align:center;background:#1f2937;color:#fff;border-radius:36px;padding:14px;text-decoration:none}.muted{color:#6b7280;font-size:14px}</style>
</head><body>${body}</body></html>`;
  }
}
