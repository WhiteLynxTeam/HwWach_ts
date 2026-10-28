import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { PendingRegistration, Invite } from '../entities/requests.entity';
import { Organization, OrganizationStatus } from '../entities/organization.entity';
import { Person } from '../entities/person.entity';
import { RequestStatus } from '../common/enums/request-status.enum';
import { MEMBER_ROLE_ID } from '../common/permissions';
import { AuthUser } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { OrgActivityService } from '../core/org-activity.service';
import { AccountsService } from './accounts.service';
import { checkForbiddenLogin, hashPassword } from './account-helpers';
import { RegisterDto } from '../auth/dto/register.dto';

// Лимиты заявок через поиск (9.1): чтобы админа не завалили
const MAX_PENDING_SEARCH_PER_ORG = 20;
const MAX_PENDING_PER_IP = 3;

export function normalizeInviteCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Регистрация человека в организации: по приглашению или через поиск.
// Любую заявку утверждает админ этой организации (9.1)
@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(PendingRegistration) private regs: Repository<PendingRegistration>,
    @InjectRepository(Invite) private invites: Repository<Invite>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    private accounts: AccountsService,
    private audit: AuditService,
    private activity: OrgActivityService,
    private dataSource: DataSource,
  ) {}

  // Приглашение по короткому коду (K7M-42Q) или токену из ссылки
  async findUsableInvite(codeOrToken: string): Promise<Invite> {
    const code = normalizeInviteCode(codeOrToken);
    const invite = await this.invites
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.person', 'p')
      .where('i.short_code = :code OR i.token_hash = :hash', { code, hash: hashInviteToken(codeOrToken.trim()) })
      .getOne();
    if (!invite || invite.revokedAt || invite.expiresAt.getTime() < Date.now() || invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('Приглашение недействительно или устарело. Попросите новое.');
    }
    return invite;
  }

  async register(dto: RegisterDto, ip: string): Promise<Omit<PendingRegistration, 'password'> & { organizationName: string }> {
    checkForbiddenLogin(dto.login);
    let organizationId: string;
    let invite: Invite | null = null;
    if (dto.inviteCode) {
      invite = await this.findUsableInvite(dto.inviteCode);
      organizationId = invite.organizationId;
    } else if (dto.organizationId) {
      organizationId = dto.organizationId;
    } else {
      throw new BadRequestException('Выберите организацию или введите код приглашения');
    }

    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org || org.deletedAt || org.status !== OrganizationStatus.ACTIVE) {
      throw new NotFoundException('Организация не найдена');
    }

    if (await this.accounts.loginTaken(dto.login)) {
      throw new ConflictException('Логин уже занят');
    }
    const samePending = await this.regs
      .createQueryBuilder('r')
      .where('lower(r.login) = lower(:login) AND r.status = :st', { login: dto.login, st: RequestStatus.PENDING })
      .getCount();
    if (samePending > 0) {
      throw new ConflictException('Заявка с таким логином уже на рассмотрении');
    }

    if (!invite) {
      const pendingSearch = await this.regs.count({ where: { organizationId, source: 'search', status: RequestStatus.PENDING } });
      if (pendingSearch >= MAX_PENDING_SEARCH_PER_ORG) {
        throw new HttpException('Организация сейчас не принимает заявки. Попросите приглашение у администратора.', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (ip) {
        const pendingIp = await this.regs
          .createQueryBuilder('r')
          .where('r.created_ip = :ip AND r.status = :st AND r.source = :src', { ip, st: RequestStatus.PENDING, src: 'search' })
          .getCount();
        if (pendingIp >= MAX_PENDING_PER_IP) {
          throw new HttpException('С вашей сети уже отправлено несколько заявок. Дождитесь решения администратора.', HttpStatus.TOO_MANY_REQUESTS);
        }
      }
    }

    const saved = await this.dataSource.transaction(async (m) => {
      if (invite) {
        // Резервируем использование сразу: общая ссылка «на N человек» не уйдёт сверх лимита
        const res = await m
          .createQueryBuilder()
          .update(Invite)
          .set({ usedCount: () => 'used_count + 1' })
          .where('id = :id AND used_count < max_uses', { id: invite.id })
          .execute();
        if (!res.affected) throw new BadRequestException('Приглашение уже использовано');
      }
      const reg = m.create(PendingRegistration, {
        organizationId,
        personId: invite?.personId ?? null,
        inviteId: invite?.id ?? null,
        source: invite ? 'invite' : 'search',
        systemRoleId: invite?.systemRoleId ?? null,
        login: dto.login.trim(),
        password: await hashPassword(dto.password),
        phone: dto.phone || null,
        lastName: dto.lastName || invite?.person?.lastName || '',
        firstName: dto.firstName || invite?.person?.firstName || '',
        middleName: dto.middleName || invite?.person?.middleName || null,
        position: dto.position || invite?.person?.position || null,
        status: RequestStatus.PENDING,
        createdIp: ip || null,
      });
      if (!reg.lastName || !reg.firstName) {
        throw new BadRequestException('Укажите фамилию и имя');
      }
      return m.save(PendingRegistration, reg);
    });

    const { password, createdIp, ...rest } = saved;
    return { ...rest, organizationName: org.shortName || org.name };
  }

  async listPending(org: string): Promise<PendingRegistration[]> {
    return this.regs.find({ where: { organizationId: org, status: RequestStatus.PENDING }, order: { createdAt: 'ASC' } });
  }

  async get(org: string, id: string): Promise<PendingRegistration> {
    const reg = await this.regs.findOne({ where: { id, organizationId: org } });
    if (!reg) throw new NotFoundException('Заявка не найдена');
    return reg;
  }

  // Публичный статус заявки — Android опрашивает его с экрана входа
  async status(id: string) {
    const reg = await this.regs.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registration request not found');
    const org = await this.orgs.findOne({ where: { id: reg.organizationId } });
    return {
      id: reg.id,
      login: reg.login,
      status: reg.status,
      adminComment: reg.adminComment ?? null,
      processedAt: reg.processedAt ?? null,
      organizationName: org ? org.shortName || org.name : null,
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt,
    };
  }

  // Одобрение: человек (новый или заведённый заранее) + учётная запись с ролью из приглашения
  async approve(user: AuthUser, id: string, dto: { comment?: string; personId?: string; roleCode?: string }, ip: string) {
    const result = await this.dataSource.transaction(async (m) => {
      const reg = await m
        .createQueryBuilder(PendingRegistration, 'r')
        .addSelect('r.password')
        .where('r.id = :id AND r.organization_id = :org', { id, org: user.org })
        .setLock('pessimistic_write')
        .getOne();
      if (!reg) throw new NotFoundException('Заявка не найдена');
      if (reg.status !== RequestStatus.PENDING) throw new ConflictException('Заявка уже обработана');

      let personId = dto.personId || reg.personId || null;
      if (personId) {
        const p = await m.findOne(Person, { where: { id: personId, organizationId: user.org } });
        if (!p) throw new NotFoundException('Человек не найден');
        if (!p.isActive) throw new BadRequestException('Человек уволен');
        if (await this.accounts.activeAccountOfPerson(p.id, m)) {
          throw new ConflictException('У этого человека уже есть активная учётная запись');
        }
      } else {
        const p = await m.save(Person, m.create(Person, {
          organizationId: user.org,
          lastName: reg.lastName,
          firstName: reg.firstName,
          middleName: reg.middleName ?? null,
          position: reg.position ?? null,
          phone: reg.phone ?? null,
          createdByAccountId: user.id,
          createdByPersonId: user.person,
        }));
        personId = p.id;
      }

      const roleId = dto.roleCode ? this.accounts.resolveAssignableRole(dto.roleCode) : reg.systemRoleId || MEMBER_ROLE_ID;
      const account = await this.accounts.createAccount(m, {
        organizationId: user.org,
        personId,
        login: reg.login,
        passwordHash: reg.password,
        roleId,
        isPassReset: false,
      });

      await m.update(PendingRegistration, reg.id, {
        status: RequestStatus.APPROVED,
        personId,
        adminComment: dto.comment ?? null,
        processedAt: new Date(),
        processedByAccountId: user.id,
        processedByPersonId: user.person,
      });
      await this.audit.log({ org: user.org, user, action: 'registration.approve', objectType: 'registration', objectId: reg.id, details: { accountId: account.id, personId, source: reg.source }, ip }, m);
      return m.findOneOrFail(PendingRegistration, { where: { id: reg.id } });
    });
    // второй человек / учётная запись — организация «наполнена» (8.6)
    await this.activity.markFilled(user.org);
    return result;
  }

  async reject(user: AuthUser, id: string, reason: string, ip: string) {
    return this.dataSource.transaction(async (m) => {
      const reg = await m.findOne(PendingRegistration, { where: { id, organizationId: user.org }, lock: { mode: 'pessimistic_write' } });
      if (!reg) throw new NotFoundException('Заявка не найдена');
      if (reg.status !== RequestStatus.PENDING) throw new ConflictException('Заявка уже обработана');
      await m.update(PendingRegistration, reg.id, {
        status: RequestStatus.REJECTED,
        adminComment: reason,
        processedAt: new Date(),
        processedByAccountId: user.id,
        processedByPersonId: user.person,
      });
      await this.audit.log({ org: user.org, user, action: 'registration.reject', objectType: 'registration', objectId: reg.id, details: { reason }, ip }, m);
      return m.findOneOrFail(PendingRegistration, { where: { id: reg.id } });
    });
  }

  // Ежесуточная задача: заявки без решения дольше срока → EXPIRED
  async expireOld(days: number): Promise<number> {
    const res = await this.regs.update(
      { status: RequestStatus.PENDING, createdAt: LessThan(new Date(Date.now() - days * 86_400_000)) },
      { status: RequestStatus.EXPIRED, processedAt: new Date() },
    );
    return res.affected ?? 0;
  }
}
