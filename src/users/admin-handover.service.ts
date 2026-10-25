import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account } from '../entities/account.entity';
import { Person } from '../entities/person.entity';
import { Organization } from '../entities/organization.entity';
import { AccountPersonHistory, EmailCodePurpose } from '../entities/misc.entity';
import { ADMIN_ROLE_ID } from '../common/permissions';
import { AuthUser } from '../common/auth-user';
import { AuditService } from '../core/audit.service';
import { EmailCodesService } from '../core/email-codes.service';
import { MailTemplates } from '../mail/mail.templates';
import { rethrowUnique, tempPassword, checkForbiddenLogin } from './account-helpers';

export interface HandoverInput {
  personId?: string;
  newPerson?: { lastName: string; firstName: string; middleName?: string; position?: string };
  login: string;
  email: string;
  code: string;
  changeOrgEmail?: boolean;
  currentPassword: string;
}

// Передача администрирования (2.3): учётная запись админа остаётся, меняется человек,
// логин и почта; пароль сбрасывается на временный, все токены отзываются
@Injectable()
export class AdminHandoverService {
  constructor(
    @InjectRepository(Account) private accounts: Repository<Account>,
    @InjectRepository(Person) private persons: Repository<Person>,
    private codes: EmailCodesService,
    private audit: AuditService,
    private dataSource: DataSource,
  ) {}

  private async currentAdmin(user: AuthUser): Promise<Account> {
    const a = await this.accounts.createQueryBuilder('a').addSelect('a.password')
      .where('a.id = :id AND a.organization_id = :org', { id: user.id, org: user.org }).getOne();
    if (!a || !a.isActive || a.systemRoleId !== ADMIN_ROLE_ID) {
      throw new ForbiddenException('Передать администрирование может только текущий администратор');
    }
    return a;
  }

  async sendCode(user: AuthUser, email: string, ip: string): Promise<{ message: string }> {
    await this.currentAdmin(user);
    if (!email || !email.includes('@')) throw new BadRequestException('Укажите почту нового администратора');
    await this.codes.sendCode(email, EmailCodePurpose.ADMIN_HANDOVER, ip, (to, code) => MailTemplates.code(to, code, 'admin_handover'));
    return { message: 'Код отправлен на почту нового администратора' };
  }

  async handover(user: AuthUser, dto: HandoverInput, ip: string) {
    const admin = await this.currentAdmin(user);
    if (!(await bcrypt.compare(dto.currentPassword, admin.password))) {
      throw new BadRequestException('Неверный пароль');
    }
    checkForbiddenLogin(dto.login);
    const email = this.codes.normalize(dto.email);
    // почта нового админа подтверждается кодом до применения передачи
    await this.codes.consume(email, EmailCodePurpose.ADMIN_HANDOVER, dto.code);

    const temp = await tempPassword();
    try {
      await this.dataSource.transaction(async (m) => {
        let person: Person | null;
        if (dto.personId) {
          person = await m.findOne(Person, { where: { id: dto.personId, organizationId: user.org } });
          if (!person) throw new NotFoundException('Человек не найден');
          if (!person.isActive) throw new BadRequestException('Человек уволен');
        } else if (dto.newPerson?.lastName && dto.newPerson?.firstName) {
          person = await m.save(Person, m.create(Person, {
            organizationId: user.org,
            lastName: dto.newPerson.lastName,
            firstName: dto.newPerson.firstName,
            middleName: dto.newPerson.middleName || null,
            position: dto.newPerson.position || null,
            createdByAccountId: user.id,
            createdByPersonId: user.person,
          }));
        } else {
          throw new BadRequestException('Выберите или заведите нового администратора');
        }
        if (person.id === admin.personId) throw new ConflictException('Этот человек уже администратор');

        // 1. своя учётка нового админа (если была) — сначала отключается: освобождает человека, почту и логин
        await m.createQueryBuilder().update(Account)
          .set({ isActive: false, tokenVersion: () => 'token_version + 1' })
          .where('person_id = :pid AND is_active AND id <> :aid', { pid: person.id, aid: admin.id })
          .execute();

        // 2. учётка админа переходит новому человеку
        await m.createQueryBuilder().update(Account)
          .set({
            personId: person.id,
            login: dto.login.trim(),
            email,
            emailVerifiedAt: new Date(),
            password: temp.hash,
            isPassReset: true,
            tokenVersion: () => 'token_version + 1',
          })
          .where('id = :id', { id: admin.id })
          .execute();

        // 3. почта организации — на почту нового админа
        if (dto.changeOrgEmail !== false) {
          await m.update(Organization, user.org, { email, emailVerifiedAt: new Date() });
        }

        // 4. история владельцев учётки и журнал
        await m.update(AccountPersonHistory, { accountId: admin.id, toAt: IsNull() }, { toAt: new Date() });
        await m.insert(AccountPersonHistory, { accountId: admin.id, personId: person.id, fromAt: new Date() });
        await this.audit.log({
          org: user.org, user, action: 'account.admin_handover', objectType: 'account', objectId: admin.id,
          details: { fromPersonId: admin.personId, toPersonId: person.id, fromLogin: admin.login, toLogin: dto.login, fromEmail: admin.email, toEmail: email },
          ip,
        }, m);
      });
    } catch (e) {
      rethrowUnique(e);
    }
    return { login: dto.login.trim(), tempPassword: temp.plain, isDefaultPassword: temp.isDefault };
  }
}
