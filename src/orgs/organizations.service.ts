import { BadRequestException, Injectable, NotFoundException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Organization, OrganizationStatus, normalizeSearch, orgSearchName } from '../entities/organization.entity';
import { Person } from '../entities/person.entity';
import { EmailCodePurpose } from '../entities/misc.entity';
import { ADMIN_ROLE_ID } from '../common/permissions';
import { AuthUser } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { EmailCodesService } from '../core/email-codes.service';
import { RateLimitService } from '../core/rate-limit.service';
import { MailSender } from '../mail/mail.service';
import { MailTemplates } from '../mail/mail.templates';
import { AccountsService } from '../users/accounts.service';
import { hashPassword } from '../users/account-helpers';
import { AuthService } from '../auth/auth.service';
import { getConfig } from '../config/configuration';
import { CompleteOrgRegistrationDto, UpdateOrganizationDto } from './dto/orgs.dto';

const MIN_SEARCH_LEN = 4;
const SAME_RESPONSE = { message: 'Мы отправили письмо на этот адрес', resendAfterSec: 60 };

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    private accounts: AccountsService,
    private codes: EmailCodesService,
    private limits: RateLimitService,
    private audit: AuditService,
    private mail: MailSender,
    private jwt: JwtService,
    private auth: AuthService,
    private dataSource: DataSource,
  ) {}

  private async emailOwner(email: string): Promise<Organization | null> {
    const org = await this.orgs.createQueryBuilder('o').where('lower(o.email) = :e AND o.deleted_at IS NULL', { e: email }).getOne();
    if (org) return org;
    const acc = await this.accounts.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.organization', 'o')
      .where('lower(a.email) = :e AND a.is_active', { e: email })
      .getOne();
    return acc?.organization ?? null;
  }

  // Шаг 1 (8.1–8.2). Ответ одинаковый, занят адрес или нет; различается только письмо
  async sendRegistrationCode(rawEmail: string, ip: string) {
    const email = this.codes.normalize(rawEmail);
    const owner = await this.emailOwner(email);
    if (owner) {
      await this.codes.sendNotice(email, EmailCodePurpose.ORG_REGISTRATION, ip, MailTemplates.emailTaken(email, owner.name));
    } else {
      await this.codes.sendCode(email, EmailCodePurpose.ORG_REGISTRATION, ip, (to, code) => MailTemplates.code(to, code, 'org_registration'));
    }
    return SAME_RESPONSE;
  }

  // Шаг 2: код верный → одноразовый registration_token на 30 минут
  async verifyRegistrationCode(rawEmail: string, code: string) {
    const email = this.codes.normalize(rawEmail);
    const row = await this.codes.consume(email, EmailCodePurpose.ORG_REGISTRATION, code);
    const token = this.jwt.sign({ typ: 'org_reg', email, cid: row.id }, { expiresIn: 1800 });
    return { registration_token: token, email, expiresInSec: 1800 };
  }

  // Шаг 3: в одной транзакции организация + человек + учётная запись админа (логин = почта) → сразу вход
  async completeRegistration(dto: CompleteOrgRegistrationDto, ip: string) {
    let decoded: any;
    try {
      decoded = this.jwt.verify(dto.registration_token);
    } catch {
      throw new UnauthorizedException('Срок подтверждения почты истёк. Начните регистрацию заново.');
    }
    if (decoded?.typ !== 'org_reg' || !decoded.email) {
      throw new UnauthorizedException('Неверный токен регистрации');
    }
    const email: string = decoded.email;

    // Не больше 1 организации за 10 минут и 3 за сутки с одного IP (8.6)
    if (ip) {
      const tenMin = await this.orgs.count({ where: { createdIp: ip, createdAt: MoreThan(new Date(Date.now() - 10 * 60_000)) } });
      const day = await this.orgs.count({ where: { createdIp: ip, createdAt: MoreThan(new Date(Date.now() - 86_400_000)) } });
      if (tenMin >= 1 || day >= 3) {
        throw new HttpException(
          `Слишком много регистраций с вашей сети, попробуйте через ${tenMin >= 1 ? 10 : 24 * 60} минут`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    if (await this.emailOwner(email)) {
      throw new BadRequestException('На этот адрес уже зарегистрирована организация');
    }

    const created = await this.dataSource.transaction(async (m) => {
      const org = await m.save(Organization, m.create(Organization, {
        name: dto.name,
        shortName: dto.shortName || null,
        searchName: orgSearchName(dto.name, dto.shortName),
        email,
        emailVerifiedAt: new Date(),
        address: dto.address || null,
        directorName: dto.directorName || null,
        ownerName: dto.ownerName || null,
        createdIp: ip || null,
        lastActivityAt: new Date(),
      }));
      const person = await m.save(Person, m.create(Person, {
        organizationId: org.id,
        lastName: dto.lastName,
        firstName: dto.firstName,
        middleName: dto.middleName || null,
        position: dto.position || null,
        isMol: true,
      }));
      const account = await this.accounts.createAccount(m, {
        organizationId: org.id,
        personId: person.id,
        login: email,
        passwordHash: await hashPassword(dto.password),
        roleId: ADMIN_ROLE_ID,
        isPassReset: false,
        email,
        emailVerifiedAt: new Date(),
      });
      await m.update(Organization, org.id, { createdByAccountId: account.id, createdByPersonId: person.id });
      await this.audit.log({
        org: org.id,
        user: { id: account.id, person: person.id, org: org.id, login: email, role: 'admin', perms: [], mol: true },
        action: 'org.create', objectType: 'organization', objectId: org.id, details: { name: org.name }, ip,
      }, m);
      return { org, account };
    });

    this.mail
      .send(MailTemplates.welcome(email, created.org.name, getConfig().retention.emptyOrgDays))
      .catch(() => undefined);
    const full = await this.accounts.loadFull(created.account.id);
    return this.auth.login(full!);
  }

  // Поиск без автоподсказок (9.1): от 4 символов, по вхождению, только название
  async search(qRaw: string, ip: string) {
    const q = (qRaw ?? '').trim();
    if ([...q].length < MIN_SEARCH_LEN) {
      throw new BadRequestException(`Введите не меньше ${MIN_SEARCH_LEN} символов`);
    }
    await this.limits.hit(`org_search:${ip}`, 30, 3_600_000, 'Слишком много поисков. Попробуйте через час.');
    // сравниваем с search_name, нормализованным в JS: lower/ILIKE для кириллицы зависят от локали БД
    const nq = normalizeSearch(q).replace(/[\\%_]/g, (c) => '\\' + c);
    const rows = await this.orgs
      .createQueryBuilder('o')
      .select(['o.id', 'o.name', 'o.shortName'])
      .where('o.deleted_at IS NULL AND o.status = :st', { st: OrganizationStatus.ACTIVE })
      .andWhere('o.search_name LIKE :like', { like: `%${nq}%` })
      .orderBy(`CASE WHEN o.search_name = :q THEN 0 WHEN o.search_name LIKE :prefix THEN 1 ELSE 2 END`, 'ASC')
      .addOrderBy('o.name', 'ASC')
      .setParameters({ q: nq, prefix: `${nq}%` })
      .limit(20)
      .getMany();
    return rows.map((o) => ({ id: o.id, name: o.name, shortName: o.shortName ?? null }));
  }

  async me(user: AuthUser) {
    const o = await this.orgs.findOne({ where: { id: user.org } });
    if (!o) throw new NotFoundException('Организация не найдена');
    const admin = await this.accounts.adminAccount(o.id);
    return {
      id: o.id,
      name: o.name,
      shortName: o.shortName ?? null,
      email: o.email ?? null,
      address: o.address ?? null,
      directorName: o.directorName ?? null,
      ownerName: o.ownerName ?? null,
      status: o.status,
      isFilled: o.isFilled,
      lastActivityAt: o.lastActivityAt,
      deletionScheduledAt: o.deletionScheduledAt ?? null,
      createdAt: o.createdAt,
      admin: admin ? { accountId: admin.id, personId: admin.personId, login: admin.login, fullName: admin.person ? `${admin.person.lastName} ${admin.person.firstName}` : null } : null,
    };
  }

  async update(user: AuthUser, dto: UpdateOrganizationDto, ip: string) {
    const patch: Partial<Organization> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.shortName !== undefined) patch.shortName = dto.shortName || null;
    if (dto.address !== undefined) patch.address = dto.address || null;
    if (dto.directorName !== undefined) patch.directorName = dto.directorName || null;
    if (dto.ownerName !== undefined) patch.ownerName = dto.ownerName || null;
    if (patch.name !== undefined || patch.shortName !== undefined) {
      const cur = await this.orgs.findOneOrFail({ where: { id: user.org } });
      patch.searchName = orgSearchName(patch.name ?? cur.name, patch.shortName !== undefined ? patch.shortName : cur.shortName);
    }
    await this.orgs.update(user.org, patch);
    await this.audit.log({ org: user.org, user, action: 'org.update', objectType: 'organization', objectId: user.org, details: { ...patch }, ip });
    return this.me(user);
  }

  async exists(id: string): Promise<boolean> {
    return (await this.orgs.count({ where: { id } })) > 0;
  }
}

