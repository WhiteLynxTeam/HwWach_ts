import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Person, personFullName } from '../entities/person.entity';
import { Account } from '../entities/account.entity';
import { PendingChanges } from '../entities/requests.entity';
import { RequestStatus } from '../common/enums/request-status.enum';
import { ADMIN_ROLE_ID, Perm, RoleCode } from '../common/permissions';
import { AuthUser, hasPerm } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { GoClientService } from '../core/go-client.service';
import { OrgActivityService } from '../core/org-activity.service';

export interface PersonInput {
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  position?: string | null;
  phone?: string | null;
  isMol?: boolean;
}

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person) private persons: Repository<Person>,
    @InjectRepository(Account) private accounts: Repository<Account>,
    @InjectRepository(PendingChanges) private changes: Repository<PendingChanges>,
    private audit: AuditService,
    private go: GoClientService,
    private activity: OrgActivityService,
    private dataSource: DataSource,
  ) {}

  // Участникам — только ФИО, должность, МОЛ и активность; телефоны и учётки — с правом persons.manage (5.1)
  private view(p: Person, full: boolean, account?: Account | null) {
    const base = {
      id: p.id,
      lastName: p.lastName,
      firstName: p.firstName,
      middleName: p.middleName ?? null,
      fullName: personFullName(p),
      position: p.position ?? null,
      isMol: p.isMol,
      isActive: p.isActive,
    };
    if (!full) return base;
    return {
      ...base,
      phone: p.phone ?? null,
      molRequestedAt: p.molRequestedAt ?? null,
      dismissedAt: p.dismissedAt ?? null,
      createdAt: p.createdAt,
      account: account
        ? { id: account.id, login: account.login, roleId: account.systemRoleId, isActive: account.isActive, lastLoginAt: account.lastLoginAt ?? null }
        : null,
    };
  }

  async list(user: AuthUser, includeDismissed: boolean) {
    const full = hasPerm(user, Perm.PERSONS_MANAGE);
    const where: any = { organizationId: user.org };
    if (!includeDismissed) where.isActive = true;
    const list = await this.persons.find({ where, order: { lastName: 'ASC', firstName: 'ASC' } });
    if (!full) return list.map((p) => this.view(p, false));
    const accs = await this.accounts.find({ where: { organizationId: user.org, isActive: true } });
    const byPerson = new Map(accs.map((a) => [a.personId, a]));
    return list.map((p) => this.view(p, true, byPerson.get(p.id)));
  }

  async get(user: AuthUser, id: string) {
    const p = await this.persons.findOne({ where: { id, organizationId: user.org } });
    if (!p) throw new NotFoundException('Человек не найден');
    const full = hasPerm(user, Perm.PERSONS_MANAGE) || id === user.person;
    const acc = full ? await this.accounts.findOne({ where: { personId: id, isActive: true } }) : null;
    return this.view(p, full, acc);
  }

  // Завести человека: админ — полностью (с признаком МОЛ); МОЛ или менеджер — только ФИО и должность (3.2)
  async create(user: AuthUser, dto: PersonInput, ip: string) {
    const canManage = hasPerm(user, Perm.PERSONS_MANAGE);
    if (!canManage) {
      if (!hasPerm(user, Perm.PERSONS_CREATE_BASIC)) throw new ForbiddenException('Недостаточно прав');
      if (user.role === RoleCode.MEMBER) {
        const me = await this.persons.findOne({ where: { id: user.person } });
        if (!me?.isMol) throw new ForbiddenException('Заводить людей может только МОЛ');
      }
    }
    if (!dto.lastName || !dto.firstName) throw new BadRequestException('Укажите фамилию и имя');
    const p = await this.persons.save(this.persons.create({
      organizationId: user.org,
      lastName: dto.lastName.trim(),
      firstName: dto.firstName.trim(),
      middleName: dto.middleName?.trim() || null,
      position: dto.position?.trim() || null,
      phone: canManage ? dto.phone || null : null,
      isMol: canManage ? !!dto.isMol : false,
      createdByAccountId: user.id,
      createdByPersonId: user.person,
    }));
    await this.audit.log({ org: user.org, user, action: 'person.create', objectType: 'person', objectId: p.id, details: { fullName: personFullName(p), isMol: p.isMol }, ip });
    await this.activity.markFilled(user.org);
    return this.view(p, canManage);
  }

  async update(user: AuthUser, id: string, dto: PersonInput, ip: string) {
    const p = await this.persons.findOne({ where: { id, organizationId: user.org } });
    if (!p) throw new NotFoundException('Человек не найден');
    const patch: Partial<Person> = {};
    if (dto.lastName !== undefined) patch.lastName = dto.lastName.trim();
    if (dto.firstName !== undefined) patch.firstName = dto.firstName.trim();
    if (dto.middleName !== undefined) patch.middleName = dto.middleName?.trim() || null;
    if (dto.position !== undefined) patch.position = dto.position?.trim() || null;
    if (dto.phone !== undefined) patch.phone = dto.phone || null;
    await this.persons.update(p.id, patch);
    await this.audit.log({ org: user.org, user, action: 'person.update', objectType: 'person', objectId: p.id, details: { ...patch }, ip });
    if (dto.isMol !== undefined && dto.isMol !== p.isMol) {
      await this.setMol(user, id, dto.isMol, ip);
    }
    return this.get(user, id);
  }

  // Признак МОЛ ставит админ. Снять нельзя, пока за человеком числятся активы (списанные не в счёт)
  async setMol(user: AuthUser, id: string, isMol: boolean, ip: string) {
    const p = await this.persons.findOne({ where: { id, organizationId: user.org } });
    if (!p) throw new NotFoundException('Человек не найден');
    if (isMol && !p.isActive) throw new BadRequestException('Человек уволен');
    if (!isMol && p.isMol) {
      const count = await this.go.molAssetsCount(p.id);
      if (count > 0) throw new ConflictException(`За человеком числятся активы (${count}) — сначала передайте их`);
    }
    await this.persons.update(p.id, { isMol, molRequestedAt: null });
    // просьба «я МОЛ», если была, считается решённой
    await this.changes.update(
      { personId: p.id, status: RequestStatus.PENDING, isMol: true },
      { status: isMol ? RequestStatus.APPROVED : RequestStatus.REJECTED, processedAt: new Date(), processedByAccountId: user.id, processedByPersonId: user.person },
    );
    await this.audit.log({ org: user.org, user, action: isMol ? 'person.mol_set' : 'person.mol_unset', objectType: 'person', objectId: p.id, ip });
    return this.get(user, id);
  }

  // Увольнение (2.2): за человеком не должно числиться активов; роли «работает с активом» закрываются в go,
  // учётная запись отключается, признак МОЛ снимается. Админа уволить нельзя — сначала передача администрирования
  async dismiss(user: AuthUser, id: string, ip: string) {
    const p = await this.persons.findOne({ where: { id, organizationId: user.org } });
    if (!p) throw new NotFoundException('Человек не найден');
    if (!p.isActive) throw new BadRequestException('Человек уже уволен');
    const admin = await this.accounts.findOne({ where: { personId: p.id, isActive: true, systemRoleId: ADMIN_ROLE_ID } });
    if (admin) throw new ConflictException('Это администратор — сначала передайте администрирование');

    const count = await this.go.molAssetsCount(p.id);
    if (count > 0) throw new ConflictException(`За человеком числятся активы (${count}) — сначала передайте или спишите их`);
    await this.go.personDismissed(p.id);

    await this.dataSource.transaction(async (m) => {
      await m.update(Person, p.id, { isActive: false, dismissedAt: new Date(), isMol: false, molRequestedAt: null });
      await m
        .createQueryBuilder()
        .update(Account)
        .set({ isActive: false, tokenVersion: () => 'token_version + 1' })
        .where('person_id = :pid AND is_active', { pid: p.id })
        .execute();
      await this.audit.log({ org: user.org, user, action: 'person.dismiss', objectType: 'person', objectId: p.id, details: { fullName: personFullName(p) }, ip }, m);
    });
    return this.get(user, id);
  }

  async restore(user: AuthUser, id: string, ip: string) {
    const p = await this.persons.findOne({ where: { id, organizationId: user.org } });
    if (!p) throw new NotFoundException('Человек не найден');
    await this.persons.update(p.id, { isActive: true, dismissedAt: null });
    await this.audit.log({ org: user.org, user, action: 'person.restore', objectType: 'person', objectId: p.id, ip });
    return this.get(user, id);
  }

  // Для go: можно ли записать актив за человеком (5.1)
  async internalGet(id: string) {
    const p = await this.persons.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Person not found');
    return {
      id: p.id,
      organization_id: p.organizationId,
      is_mol: p.isMol,
      is_active: p.isActive,
      full_name: personFullName(p),
      has_account: (await this.accounts.count({ where: { personId: p.id, isActive: true } })) > 0,
    };
  }
}
