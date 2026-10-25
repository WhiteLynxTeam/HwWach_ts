import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PendingChanges, PendingResetPass } from '../entities/requests.entity';
import { Person } from '../entities/person.entity';
import { Account } from '../entities/account.entity';
import { RequestStatus } from '../common/enums/request-status.enum';
import { AuthUser } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { tempPassword } from './account-helpers';
import { AccountsService } from './accounts.service';

export interface ChangeInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phone?: string;
  position?: string;
  isMol?: boolean;
}

// Заявки на смену профиля (в том числе «я МОЛ») и на сброс пароля — утверждает админ организации
@Injectable()
export class ChangeRequestsService {
  constructor(
    @InjectRepository(PendingChanges) private changes: Repository<PendingChanges>,
    @InjectRepository(PendingResetPass) private resets: Repository<PendingResetPass>,
    @InjectRepository(Person) private persons: Repository<Person>,
    private accountsService: AccountsService,
    private audit: AuditService,
    private dataSource: DataSource,
  ) {}

  async request(user: AuthUser, dto: ChangeInput): Promise<PendingChanges> {
    const person = await this.persons.findOne({ where: { id: user.person } });
    if (!person) throw new NotFoundException('Человек не найден');
    const existing = await this.changes.findOne({ where: { personId: person.id, status: RequestStatus.PENDING } });
    if (existing) throw new ConflictException('У вас уже есть нерассмотренный запрос на изменение данных');

    const req = this.changes.create({
      organizationId: user.org,
      personId: person.id,
      requestedByAccountId: user.id,
      status: RequestStatus.PENDING,
    });
    if (dto.firstName && dto.firstName !== person.firstName) req.firstName = dto.firstName;
    if (dto.lastName && dto.lastName !== person.lastName) req.lastName = dto.lastName;
    if (dto.middleName && dto.middleName !== person.middleName) req.middleName = dto.middleName;
    if (dto.phone && dto.phone !== person.phone) req.phone = dto.phone;
    if (dto.position && dto.position !== person.position) req.position = dto.position;
    if (dto.isMol === true && !person.isMol) req.isMol = true;
    if (!req.firstName && !req.lastName && !req.middleName && !req.phone && !req.position && !req.isMol) {
      throw new ConflictException('Нет изменений профиля для сохранения');
    }
    const saved = await this.changes.save(req);
    if (req.isMol) {
      await this.persons.update(person.id, { molRequestedAt: new Date() });
    }
    return saved;
  }

  async list(org: string): Promise<PendingChanges[]> {
    return this.changes.find({ where: { organizationId: org }, relations: ['person'], order: { createdAt: 'DESC' } });
  }

  async get(org: string, id: string): Promise<PendingChanges> {
    const r = await this.changes.findOne({ where: { id, organizationId: org }, relations: ['person'] });
    if (!r) throw new NotFoundException('Запрос на изменение не найден');
    return r;
  }

  async approve(user: AuthUser, id: string, comment: string | undefined, ip: string): Promise<PendingChanges> {
    return this.dataSource.transaction(async (m) => {
      const r = await m.findOne(PendingChanges, { where: { id, organizationId: user.org }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Запрос на изменение не найден');
      if (r.status !== RequestStatus.PENDING) throw new ConflictException('Запрос на изменение уже обработан');
      const patch: Partial<Person> = {};
      if (r.firstName) patch.firstName = r.firstName;
      if (r.lastName) patch.lastName = r.lastName;
      if (r.middleName) patch.middleName = r.middleName;
      if (r.phone) patch.phone = r.phone;
      if (r.position) patch.position = r.position;
      if (r.isMol) {
        patch.isMol = true;
        patch.molRequestedAt = null;
      }
      await m.update(Person, r.personId, patch);
      await m.update(PendingChanges, r.id, {
        status: RequestStatus.APPROVED,
        adminComment: comment ?? null,
        processedAt: new Date(),
        processedByAccountId: user.id,
        processedByPersonId: user.person,
      });
      await this.audit.log({ org: user.org, user, action: r.isMol ? 'person.mol_set' : 'person.change_approve', objectType: 'person', objectId: r.personId, details: { requestId: r.id, ...patch }, ip }, m);
      return m.findOneOrFail(PendingChanges, { where: { id: r.id }, relations: ['person'] });
    });
  }

  async reject(user: AuthUser, id: string, reason: string | undefined, ip: string): Promise<PendingChanges> {
    return this.dataSource.transaction(async (m) => {
      const r = await m.findOne(PendingChanges, { where: { id, organizationId: user.org }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Запрос на изменение не найден');
      if (r.status !== RequestStatus.PENDING) throw new ConflictException('Запрос на изменение уже обработан');
      await m.update(PendingChanges, r.id, {
        status: RequestStatus.REJECTED,
        adminComment: reason ?? null,
        processedAt: new Date(),
        processedByAccountId: user.id,
        processedByPersonId: user.person,
      });
      if (r.isMol) await m.update(Person, r.personId, { molRequestedAt: null });
      await this.audit.log({ org: user.org, user, action: 'person.change_reject', objectType: 'person', objectId: r.personId, details: { requestId: r.id, reason }, ip }, m);
      return m.findOneOrFail(PendingChanges, { where: { id: r.id }, relations: ['person'] });
    });
  }

  // --- Сброс пароля ---

  // «Забыли пароль?» с экрана входа. Вход не блокируется до решения админа
  async requestReset(login: string): Promise<{ id: string; status: RequestStatus }> {
    const acc = await this.accountsService.findActiveByLogin(login);
    if (!acc) throw new NotFoundException('Пользователь с таким логином не найден');
    const existing = await this.resets.findOne({ where: { accountId: acc.id, status: RequestStatus.PENDING } });
    if (existing) throw new ConflictException('Заявка на сброс пароля для этого пользователя уже находится на рассмотрении');
    const saved = await this.resets.save(this.resets.create({ organizationId: acc.organizationId, accountId: acc.id, status: RequestStatus.PENDING }));
    return { id: saved.id, status: saved.status };
  }

  async listResets(org: string) {
    const list = await this.resets.find({
      where: { organizationId: org, status: RequestStatus.PENDING },
      relations: ['account', 'account.person'],
      order: { createdAt: 'DESC' },
    });
    return list.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      status: r.status,
      createdAt: r.createdAt,
      processedAt: r.processedAt ?? null,
      // прежний формат для десктопа: user.login / ФИО
      user: r.account
        ? { id: r.account.id, login: r.account.login, lastName: r.account.person?.lastName, firstName: r.account.person?.firstName, middleName: r.account.person?.middleName }
        : null,
    }));
  }

  async approveReset(user: AuthUser, id: string, password: string | undefined, ip: string) {
    const r = await this.resets.findOne({ where: { id, organizationId: user.org } });
    if (!r) throw new NotFoundException('Заявка на сброс пароля не найдена');
    if (r.status !== RequestStatus.PENDING) throw new ConflictException('Эта заявка уже обработана');
    const temp = await tempPassword(password);
    await this.dataSource.transaction(async (m) => {
      await m.createQueryBuilder().update(Account)
        .set({ password: temp.hash, isPassReset: true, tokenVersion: () => 'token_version + 1' })
        .where('id = :id', { id: r.accountId })
        .execute();
      await m.update(PendingResetPass, r.id, { status: RequestStatus.APPROVED, processedAt: new Date(), processedByAccountId: user.id, processedByPersonId: user.person });
      await this.audit.log({ org: user.org, user, action: 'account.password_reset', objectType: 'account', objectId: r.accountId, ip }, m);
    });
    return { request: { id: r.id, status: RequestStatus.APPROVED }, tempPassword: temp.plain, isDefaultPassword: temp.isDefault };
  }

  async rejectReset(user: AuthUser, id: string) {
    const r = await this.resets.findOne({ where: { id, organizationId: user.org } });
    if (!r) throw new NotFoundException('Заявка на сброс пароля не найдена');
    if (r.status !== RequestStatus.PENDING) throw new ConflictException('Эта заявка уже обработана');
    await this.resets.update(r.id, { status: RequestStatus.REJECTED, processedAt: new Date(), processedByAccountId: user.id, processedByPersonId: user.person });
    return { id: r.id, status: RequestStatus.REJECTED };
  }
}
