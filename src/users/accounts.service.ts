import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger,
  NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account } from '../entities/account.entity';
import { Person, personFullName } from '../entities/person.entity';
import { Organization, OrganizationStatus, orgSearchName } from '../entities/organization.entity';
import { SystemRole } from '../entities/system-role.entity';
import { AccountPersonHistory } from '../entities/misc.entity';
import { ADMIN_ROLE_ID, MEMBER_ROLE_ID, Perm, RoleCode, roleIdByCode } from '../common/permissions';
import { AuthUser, hasPerm } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { OrgActivityService } from '../core/org-activity.service';
import { checkForbiddenLogin, hashPassword, rethrowUnique, tempPassword } from './account-helpers';

export interface CreateAccountInput {
  organizationId: string;
  personId: string;
  login: string;
  passwordHash: string;
  roleId: string;
  isPassReset: boolean;
  email?: string | null;
  emailVerifiedAt?: Date | null;
  accessExpiresAt?: Date | null;
}

@Injectable()
export class AccountsService implements OnModuleInit {
  private readonly logger = new Logger(AccountsService.name);
  private rolePerms = new Map<string, { code: string; name: string; perms: string[] }>();

  constructor(
    @InjectRepository(Account) private accounts: Repository<Account>,
    @InjectRepository(Person) private persons: Repository<Person>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(SystemRole) private roles: Repository<SystemRole>,
    private dataSource: DataSource,
    private audit: AuditService,
    private activity: OrgActivityService,
  ) {}

  // Администратор по умолчанию из env (DEFAULT_ADMIN_LOGIN / DEFAULT_ADMIN_PASSWORD):
  // если его ещё нет — создаём свою организацию, человека и учётную запись админа.
  // Пароль синхронизируется с env, как раньше
  async onModuleInit() {
    try {
      await this.loadRoles();
      const login = process.env.DEFAULT_ADMIN_LOGIN;
      const password = process.env.DEFAULT_ADMIN_PASSWORD;
      if (!login || !password) {
        this.logger.warn('DEFAULT_ADMIN_LOGIN / DEFAULT_ADMIN_PASSWORD не заданы — админ по умолчанию не создаётся');
        return;
      }
      const existing = await this.accounts
        .createQueryBuilder('a')
        .addSelect('a.password')
        .where('lower(a.login) = lower(:login) AND a.is_active', { login })
        .getOne();
      if (existing) {
        if (!(await bcrypt.compare(password, existing.password))) {
          await this.accounts.update(existing.id, { password: await hashPassword(password) });
          this.logger.log(`Пароль админа по умолчанию обновлён: ${login}`);
        }
        return;
      }
      await this.dataSource.transaction(async (m) => {
        const orgName = process.env.DEFAULT_ORG_NAME || 'Моя организация';
        const org = await m.save(Organization, m.create(Organization, {
          name: orgName,
          searchName: orgSearchName(orgName),
          email: process.env.DEFAULT_ORG_EMAIL?.toLowerCase() || null,
          emailVerifiedAt: process.env.DEFAULT_ORG_EMAIL ? new Date() : null,
          lastActivityAt: new Date(),
          // своя организация не должна удалиться как пустая
          isFilled: true,
        }));
        const person = await m.save(Person, m.create(Person, {
          organizationId: org.id,
          lastName: process.env.DEFAULT_ADMIN_LAST_NAME || 'Администратор',
          firstName: process.env.DEFAULT_ADMIN_FIRST_NAME || 'Главный',
          isMol: true,
        }));
        await this.createAccount(m, {
          organizationId: org.id,
          personId: person.id,
          login,
          passwordHash: await hashPassword(password),
          roleId: ADMIN_ROLE_ID,
          isPassReset: false,
        });
      });
      this.logger.log(`Создан админ по умолчанию ${login} и его организация`);
    } catch (e) {
      this.logger.error(`Не удалось создать админа по умолчанию: ${(e as Error).message}`);
    }
  }

  async loadRoles(): Promise<void> {
    const list = await this.roles.find({ relations: ['permissions'], order: { sortOrder: 'ASC' } });
    this.rolePerms = new Map(list.map((r) => [r.id, { code: r.code, name: r.name, perms: (r.permissions ?? []).map((p) => p.code) }]));
  }

  role(roleId: string): { code: string; name: string; perms: string[] } {
    return this.rolePerms.get(roleId) ?? { code: 'unknown', name: '—', perms: [] };
  }

  async listRoles(): Promise<{ id: string; code: string; name: string; perms: string[] }[]> {
    if (this.rolePerms.size === 0) await this.loadRoles();
    return [...this.rolePerms.entries()].map(([id, r]) => ({ id, ...r }));
  }

  // Учётная запись с человеком и организацией — для входа, refresh и /me
  async loadFull(accountId: string, withPassword = false): Promise<Account | null> {
    const qb = this.accounts
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.person', 'p')
      .leftJoinAndSelect('a.organization', 'o')
      .where('a.id = :id', { id: accountId });
    if (withPassword) qb.addSelect('a.password');
    return qb.getOne();
  }

  // Причина, по которой учётной записью нельзя пользоваться (5): null — можно
  unusableReason(a: Account): string | null {
    if (!a.isActive) return 'Учётная запись отключена';
    if (a.accessExpiresAt && a.accessExpiresAt.getTime() < Date.now()) return 'Срок доступа истёк';
    if (!a.person?.isActive) return 'Сотрудник уволен';
    if (!a.organization || a.organization.deletedAt) return 'Организация удалена';
    if (a.organization.status === OrganizationStatus.BLOCKED) return 'Организация заблокирована';
    return null;
  }

  async validateLogin(login: string, password: string): Promise<Account | null> {
    checkForbiddenLogin(login);
    const found = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.password')
      .leftJoinAndSelect('a.person', 'p')
      .leftJoinAndSelect('a.organization', 'o')
      .where('lower(a.login) = lower(:login) AND a.is_active', { login })
      .getOne();
    if (!found || !(await bcrypt.compare(password, found.password))) {
      return null;
    }
    const reason = this.unusableReason(found);
    if (reason) {
      throw new ForbiddenException(reason);
    }
    if (found.isPassReset) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PRECONDITION_FAILED,
          message: 'Необходимо сменить временный пароль перед авторизацией',
          error_code: 'PASSWORD_CHANGE_REQUIRED',
        },
        HttpStatus.PRECONDITION_FAILED,
      );
    }
    await this.accounts.update(found.id, { lastLoginAt: new Date() });
    await this.activity.touch(found.organizationId);
    return found;
  }

  // Профиль в прежнем формате /users/:id — его читают Android и десктоп
  profile(a: Account) {
    const r = this.role(a.systemRoleId);
    return {
      id: a.id,
      login: a.login,
      email: a.email ?? null,
      personId: a.personId,
      organizationId: a.organizationId,
      organizationName: a.organization?.shortName || a.organization?.name || null,
      lastName: a.person?.lastName ?? null,
      firstName: a.person?.firstName ?? null,
      middleName: a.person?.middleName ?? null,
      fullName: a.person ? personFullName(a.person) : null,
      phone: a.person?.phone ?? null,
      position: a.person?.position ?? null,
      isMol: a.person?.isMol ?? false,
      molRequested: !!a.person?.molRequestedAt,
      role: r.code,
      roleName: r.name,
      perms: r.perms,
      isActive: a.isActive,
      isPassReset: a.isPassReset,
      accessExpiresAt: a.accessExpiresAt ?? null,
      lastLoginAt: a.lastLoginAt ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async getProfile(user: AuthUser, id: string) {
    if (id !== user.id && !hasPerm(user, Perm.ACCOUNTS_MANAGE)) {
      throw new ForbiddenException('Недостаточно прав');
    }
    const a = await this.loadFull(id);
    if (!a || a.organizationId !== user.org) {
      throw new NotFoundException('Учётная запись не найдена');
    }
    return this.profile(a);
  }

  // Создать учётную запись и открыть период в account_person_history
  async createAccount(m: EntityManager, input: CreateAccountInput): Promise<Account> {
    checkForbiddenLogin(input.login);
    let saved: Account;
    try {
      saved = await m.save(Account, m.create(Account, {
        organizationId: input.organizationId,
        personId: input.personId,
        login: input.login.trim(),
        password: input.passwordHash,
        systemRoleId: input.roleId,
        isPassReset: input.isPassReset,
        email: input.email ? input.email.toLowerCase() : null,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        accessExpiresAt: input.accessExpiresAt ?? null,
      }));
    } catch (e) {
      rethrowUnique(e);
    }
    await m.insert(AccountPersonHistory, { accountId: saved.id, personId: input.personId, fromAt: new Date() });
    return saved;
  }

  async loginTaken(login: string, m?: EntityManager): Promise<boolean> {
    const repo = m ? m.getRepository(Account) : this.accounts;
    return (await repo.createQueryBuilder('a').where('lower(a.login) = lower(:login) AND a.is_active', { login }).getCount()) > 0;
  }

  // --- Управление учётными записями (accounts.manage) ---

  async list(org: string) {
    const list = await this.accounts.find({
      where: { organizationId: org },
      relations: ['person', 'organization'],
      order: { createdAt: 'ASC' },
    });
    return list.map((a) => this.profile(a));
  }

  // Вариант «В»: админ сам заводит учётную запись человеку (9.1). Временный пароль — смена при первом входе
  async createByAdmin(
    user: AuthUser,
    dto: { personId?: string; lastName?: string; firstName?: string; middleName?: string; position?: string; phone?: string; login: string; password?: string; roleCode?: string; accessExpiresAt?: string; email?: string },
    ip: string,
  ) {
    const roleId = this.resolveAssignableRole(dto.roleCode);
    const temp = await tempPassword(dto.password);
    const account = await this.dataSource.transaction(async (m) => {
      let personId = dto.personId;
      if (personId) {
        const p = await m.findOne(Person, { where: { id: personId, organizationId: user.org } });
        if (!p) throw new NotFoundException('Человек не найден');
        if (!p.isActive) throw new BadRequestException('Человек уволен');
      } else {
        if (!dto.lastName || !dto.firstName) throw new BadRequestException('Укажите фамилию и имя');
        const p = await m.save(Person, m.create(Person, {
          organizationId: user.org,
          lastName: dto.lastName,
          firstName: dto.firstName,
          middleName: dto.middleName || null,
          position: dto.position || null,
          phone: dto.phone || null,
          createdByAccountId: user.id,
          createdByPersonId: user.person,
        }));
        personId = p.id;
      }
      const acc = await this.createAccount(m, {
        organizationId: user.org,
        personId,
        login: dto.login,
        passwordHash: temp.hash,
        roleId,
        isPassReset: true,
        email: dto.email || null,
        accessExpiresAt: dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null,
      });
      await this.audit.log({ org: user.org, user, action: 'account.create', objectType: 'account', objectId: acc.id, details: { personId, role: this.role(roleId).code }, ip }, m);
      return acc;
    });
    await this.activity.markFilled(user.org);
    const full = await this.loadFull(account.id);
    return { account: this.profile(full!), tempPassword: temp.plain, isDefaultPassword: temp.isDefault };
  }

  // Роль admin руками не назначается — только передачей администрирования (2.3)
  resolveAssignableRole(code?: string): string {
    if (!code) return MEMBER_ROLE_ID;
    if (code === RoleCode.ADMIN) {
      throw new BadRequestException('Администратор в организации один — используйте передачу администрирования');
    }
    const id = roleIdByCode(code);
    if (!id) throw new BadRequestException('Неизвестная роль');
    return id;
  }

  async update(user: AuthUser, id: string, dto: { roleCode?: string; isActive?: boolean; accessExpiresAt?: string | null; login?: string; email?: string | null }, ip: string) {
    const a = await this.accounts.findOne({ where: { id, organizationId: user.org } });
    if (!a) throw new NotFoundException('Учётная запись не найдена');
    const isAdminAccount = a.systemRoleId === ADMIN_ROLE_ID;
    const changes: Partial<Account> = {};
    let bump = false;

    if (dto.roleCode !== undefined) {
      if (isAdminAccount) throw new BadRequestException('Роль администратора меняется только передачей администрирования');
      const roleId = this.resolveAssignableRole(dto.roleCode);
      if (roleId !== a.systemRoleId) {
        changes.systemRoleId = roleId;
        bump = true;
      }
    }
    if (dto.isActive !== undefined && dto.isActive !== a.isActive) {
      if (isAdminAccount && !dto.isActive) throw new BadRequestException('Нельзя отключить администратора');
      changes.isActive = dto.isActive;
      bump = true;
    }
    if (dto.accessExpiresAt !== undefined) {
      changes.accessExpiresAt = dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null;
      bump = true;
    }
    if (dto.login !== undefined && dto.login.trim() !== a.login) {
      checkForbiddenLogin(dto.login);
      changes.login = dto.login.trim();
    }
    if (dto.email !== undefined) {
      changes.email = dto.email ? dto.email.toLowerCase() : null;
      changes.emailVerifiedAt = null;
    }
    if (bump) changes.tokenVersion = a.tokenVersion + 1;
    try {
      await this.accounts.update(a.id, changes);
    } catch (e) {
      rethrowUnique(e);
    }
    await this.audit.log({
      org: user.org, user, action: dto.roleCode !== undefined ? 'account.role_change' : 'account.update',
      objectType: 'account', objectId: a.id, details: { ...dto }, ip,
    });
    return this.profile((await this.loadFull(a.id))!);
  }

  async resetPassword(user: AuthUser, id: string, password: string | undefined, ip: string) {
    const a = await this.accounts.findOne({ where: { id, organizationId: user.org } });
    if (!a) throw new NotFoundException('Учётная запись не найдена');
    const temp = await tempPassword(password);
    await this.accounts.update(a.id, { password: temp.hash, isPassReset: true, tokenVersion: a.tokenVersion + 1 });
    await this.audit.log({ org: user.org, user, action: 'account.password_reset', objectType: 'account', objectId: a.id, ip });
    return { tempPassword: temp.plain, isDefaultPassword: temp.isDefault };
  }

  // Смена своего пароля: старые refresh отзываются, клиент получает новую пару токенов
  async changePassword(accountId: string, oldPassword: string, newPassword: string): Promise<Account> {
    const a = await this.accounts.createQueryBuilder('a').addSelect('a.password').where('a.id = :id', { id: accountId }).getOne();
    if (!a) throw new NotFoundException('Пользователь не найден');
    if (!(await bcrypt.compare(oldPassword, a.password))) throw new BadRequestException('Неверный старый пароль');
    await this.accounts.update(a.id, { password: await hashPassword(newPassword), isPassReset: false, tokenVersion: a.tokenVersion + 1 });
    return (await this.loadFull(a.id))!;
  }

  async changeTempPassword(login: string, oldPassword: string, newPassword: string): Promise<void> {
    const a = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.password')
      .where('lower(a.login) = lower(:login) AND a.is_active', { login })
      .getOne();
    if (!a) throw new NotFoundException('Пользователь не найден');
    if (!a.isPassReset) throw new BadRequestException('Пользователь не требует смены временного пароля');
    if (!(await bcrypt.compare(oldPassword, a.password))) throw new BadRequestException('Неверный старый пароль');
    await this.accounts.update(a.id, { password: await hashPassword(newPassword), isPassReset: false, tokenVersion: a.tokenVersion + 1 });
  }

  async findActiveByLogin(login: string): Promise<Account | null> {
    return this.accounts
      .createQueryBuilder('a')
      .where('lower(a.login) = lower(:login) AND a.is_active', { login })
      .getOne();
  }

  async activeAccountOfPerson(personId: string, m?: EntityManager): Promise<Account | null> {
    const repo = m ? m.getRepository(Account) : this.accounts;
    return repo.findOne({ where: { personId, isActive: true } });
  }

  // Активная учётная запись админа организации
  async adminAccount(org: string): Promise<Account | null> {
    return this.accounts.findOne({ where: { organizationId: org, systemRoleId: ADMIN_ROLE_ID, isActive: true }, relations: ['person'] });
  }

  // Почты для писем организации: почта организации, админа и всех участников с подтверждённой почтой (8.6)
  async orgRecipients(org: Organization): Promise<string[]> {
    const list = await this.accounts.find({ where: { organizationId: org.id, isActive: true } });
    const emails = new Set<string>();
    if (org.email) emails.add(org.email.toLowerCase());
    for (const a of list) {
      if (a.email && (a.emailVerifiedAt || a.systemRoleId === ADMIN_ROLE_ID)) emails.add(a.email.toLowerCase());
    }
    return [...emails];
  }

  get repo(): Repository<Account> {
    return this.accounts;
  }
}
