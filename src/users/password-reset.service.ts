import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { EmailCodePurpose } from '../entities/misc.entity';
import { PendingResetPass } from '../entities/requests.entity';
import { RequestStatus } from '../common/enums/request-status.enum';
import { ADMIN_ROLE_ID } from '../common/permissions';
import { AuditService } from '../core/audit.service';
import { EmailCodesService } from '../core/email-codes.service';
import { MailSender } from '../mail/mail.service';
import { MailTemplates } from '../mail/mail.templates';
import { hashPassword } from './account-helpers';

const SAME_RESPONSE = { message: 'Если адрес есть в HwWach, мы отправили на него код', resendAfterSec: 60 };

// Сброс пароля кодом на почту (8.2) — без админа, в том числе для самого админа.
// Код уходит только на подтверждённую почту (у админа она подтверждена при регистрации):
// почту, которую админ вписал человеку сам, могли набрать с опечаткой — по ней учётную запись не отдаём.
// Нет почты — заявка админу («Забыли пароль?» по логину)
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(Account) private accounts: Repository<Account>,
    private codes: EmailCodesService,
    private mail: MailSender,
    private audit: AuditService,
    private dataSource: DataSource,
  ) {}

  private findByEmail(email: string): Promise<Account | null> {
    return this.accounts
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.organization', 'o')
      .where('lower(a.email) = :e AND a.is_active', { e: email })
      .getOne();
  }

  private canReset(a: Account | null): a is Account {
    return !!a && (!!a.emailVerifiedAt || a.systemRoleId === ADMIN_ROLE_ID);
  }

  // Шаг 1. Ответ одинаковый, есть учётная запись или нет; различается только письмо
  async sendCode(rawEmail: string, ip: string) {
    const email = this.codes.normalize(rawEmail);
    const acc = await this.findByEmail(email);
    if (this.canReset(acc)) {
      await this.codes.sendCode(email, EmailCodePurpose.PASSWORD_RESET, ip, (to, code) => MailTemplates.code(to, code, 'password_reset'));
    } else {
      await this.codes.sendNotice(email, EmailCodePurpose.PASSWORD_RESET, ip, MailTemplates.resetNoAccount(email, !!acc));
    }
    return SAME_RESPONSE;
  }

  // Шаг 2. Код верный → новый пароль; все токены отзываются, заявки админу на сброс закрываются
  async confirm(rawEmail: string, code: string, newPassword: string, ip: string) {
    const email = this.codes.normalize(rawEmail);
    await this.codes.consume(email, EmailCodePurpose.PASSWORD_RESET, code);
    const acc = await this.findByEmail(email);
    // За 10 минут жизни кода учётную запись могли отключить или снять подтверждение почты
    if (!this.canReset(acc)) throw new BadRequestException('Код неверный или устарел. Запросите новый.');
    const hash = await hashPassword(newPassword);
    await this.dataSource.transaction(async (m) => {
      await m.createQueryBuilder().update(Account)
        .set({ password: hash, isPassReset: false, tokenVersion: () => 'token_version + 1' })
        .where('id = :id', { id: acc.id })
        .execute();
      await m.update(PendingResetPass, { accountId: acc.id, status: RequestStatus.PENDING }, { status: RequestStatus.EXPIRED, processedAt: new Date() });
      await this.audit.log({ org: acc.organizationId, action: 'account.password_reset_by_email', objectType: 'account', objectId: acc.id, ip }, m);
    });
    // Письмо «пароль изменён» — на случай, если меняли не вы; не дошло — пароль всё равно сменён
    this.mail.send(MailTemplates.passwordChanged(email, acc.login, acc.organization?.name ?? ''))
      .catch((e) => this.logger.error(`mail to ${email} failed: ${e}`));
    return {
      message: 'Пароль изменён',
      login: acc.login,
      organization: acc.organization ? { number: acc.organization.number, name: acc.organization.name } : null,
    };
  }
}
