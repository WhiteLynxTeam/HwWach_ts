import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { EmailCode, EmailCodePurpose } from '../entities/misc.entity';
import { MailMessage, MailSender } from '../mail/mail.service';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_MS = 60_000;
const HOUR = 3_600_000;
const MAX_ATTEMPTS = 5;

// 6-значные коды на почту (8.2). Лимиты считаются по самой таблице email_codes:
// не чаще раза в 60 с, 5 писем в час на почту, 20 в час на IP
@Injectable()
export class EmailCodesService {
  private readonly logger = new Logger(EmailCodesService.name);

  constructor(
    @InjectRepository(EmailCode) private repo: Repository<EmailCode>,
    private mail: MailSender,
  ) {}

  normalize(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  private async checkLimits(email: string, ip: string): Promise<void> {
    const last = await this.repo.findOne({ where: { email }, order: { createdAt: 'DESC' } });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_MS) {
      throw new HttpException('Письмо уже отправлено. Повторить можно через минуту.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const hourAgo = new Date(Date.now() - HOUR);
    const perEmail = await this.repo.count({ where: { email, createdAt: MoreThan(hourAgo) } });
    if (perEmail >= 5) {
      throw new HttpException('Слишком много писем на этот адрес. Попробуйте через час.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (ip) {
      const perIp = await this.repo.count({ where: { ip, createdAt: MoreThan(hourAgo) } });
      if (perIp >= 20) {
        throw new HttpException('Слишком много писем с вашей сети. Попробуйте через час.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  private async deliver(msg: MailMessage): Promise<void> {
    try {
      await this.mail.send(msg);
    } catch (e) {
      this.logger.error(`mail to ${msg.to} failed: ${e}`);
      throw new HttpException('Не удалось отправить письмо, попробуйте позже', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // Отправить код на почту
  async sendCode(
    rawEmail: string,
    purpose: EmailCodePurpose,
    ip: string,
    build: (to: string, code: string) => MailMessage,
  ): Promise<void> {
    const email = this.normalize(rawEmail);
    await this.checkLimits(email, ip);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.repo.insert({
      email,
      purpose,
      codeHash: await bcrypt.hash(code, 8),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      ip: ip || null,
    });
    await this.deliver(build(email, code));
  }

  // Письмо без кода (адрес уже занят) — та же запись для лимитов, ответ клиенту одинаковый
  async sendNotice(rawEmail: string, purpose: EmailCodePurpose, ip: string, msg: MailMessage): Promise<void> {
    const email = this.normalize(rawEmail);
    await this.checkLimits(email, ip);
    await this.repo.insert({ email, purpose, codeHash: null, expiresAt: new Date(), ip: ip || null });
    await this.deliver(msg);
  }

  // Проверить и погасить код. После 5 неверных попыток код сгорает
  async consume(rawEmail: string, purpose: EmailCodePurpose, code: string): Promise<EmailCode> {
    const email = this.normalize(rawEmail);
    const row = await this.repo.findOne({
      where: { email, purpose, consumedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!row || !row.codeHash || row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Код неверный или устарел. Запросите новый.');
    }
    const ok = await bcrypt.compare(String(code ?? '').trim(), row.codeHash);
    if (!ok) {
      await this.repo.increment({ id: row.id }, 'attempts', 1);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      throw new BadRequestException(left > 0 ? `Неверный код. Осталось попыток: ${left}` : 'Код сгорел. Запросите новый.');
    }
    await this.repo.update(row.id, { consumedAt: new Date() });
    return row;
  }

  async cleanup(olderThan: Date): Promise<number> {
    const res = await this.repo.delete({ createdAt: LessThan(olderThan) });
    return res.affected ?? 0;
  }
}
