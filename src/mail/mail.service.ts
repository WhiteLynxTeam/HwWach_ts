import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Отправка писем за интерфейсом: способ меняется без правки логики (8.2).
// MAIL_DRIVER=gmail — Gmail API с ящика команды, console — письмо в лог (локально и в тестах).
export abstract class MailSender {
  abstract send(msg: MailMessage): Promise<void>;
  // обмен refresh → access без отправки: ежесуточная задача держит токен «используемым» (8.2)
  abstract keepAlive(): Promise<void>;
}

export class ConsoleMailSender extends MailSender {
  private readonly logger = new Logger('ConsoleMail');

  async send(msg: MailMessage): Promise<void> {
    this.logger.log(`to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
  }

  async keepAlive(): Promise<void> {}
}

export class GmailRevokedError extends Error {
  constructor() {
    super('Gmail: refresh-токен отозван — получить новый (8.2)');
  }
}

@Injectable()
export class GmailMailSender extends MailSender {
  private readonly logger = new Logger('GmailMail');
  private accessToken: string | null = null;
  private accessExpiresAt = 0;

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessExpiresAt - 60_000) {
      return this.accessToken;
    }
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID ?? '',
        client_secret: process.env.GMAIL_CLIENT_SECRET ?? '',
        refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? '',
        grant_type: 'refresh_token',
      }),
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (data?.error === 'invalid_grant') {
        // Пароль ящика сменили, токен не использовался 6 месяцев или доступ отозвали вручную
        this.logger.error('Gmail: refresh-токен отозван — получить новый (8.2)');
        throw new GmailRevokedError();
      }
      throw new Error(`Gmail token error ${resp.status}: ${JSON.stringify(data)}`);
    }
    this.accessToken = data.access_token;
    this.accessExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken!;
  }

  async keepAlive(): Promise<void> {
    this.accessToken = null;
    await this.token();
  }

  async send(msg: MailMessage): Promise<void> {
    const from = process.env.MAIL_FROM ?? '';
    const fromName = process.env.MAIL_FROM_NAME ?? 'HwWach';
    const encodeHeader = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
    const raw = [
      `From: ${encodeHeader(fromName)} <${from}>`,
      `To: ${msg.to}`,
      `Subject: ${encodeHeader(msg.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(msg.text, 'utf8').toString('base64'),
    ].join('\r\n');

    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(raw, 'utf8').toString('base64url') }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gmail send error ${resp.status}: ${text}`);
    }
  }
}

export function createMailSender(): MailSender {
  return process.env.MAIL_DRIVER === 'gmail' ? new GmailMailSender() : new ConsoleMailSender();
}
