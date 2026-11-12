import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

// Отправка писем за интерфейсом: способ меняется без правки логики (8.2).
// MAIL_DRIVER=appsscript — веб-приложение Apps Script в ящике команды (без Google Cloud, см. apps-script/mailer.gs),
// gmail — Gmail API с ящика команды, console — письмо в лог (локально и в тестах).
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

// Скрипт отправляет через MailApp от имени ящика, где опубликован. Запрос защищён общим секретом;
// /exec отвечает 302 на googleusercontent.com — fetch идёт по редиректу и получает JSON
export class AppsScriptMailSender extends MailSender {
  private readonly logger = new Logger('AppsScriptMail');

  private async call(payload: Record<string, unknown>): Promise<any> {
    const resp = await fetch(process.env.APPS_SCRIPT_URL ?? '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET ?? '', ...payload }),
    });
    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // вместо JSON — страница Google: скрипт не опубликован для «Anyone» или неверный URL
      throw new Error(`Apps Script: не JSON (${resp.status}): ${text.slice(0, 200)}`);
    }
    if (!data?.ok) throw new Error(`Apps Script: ${data?.error ?? 'unknown error'}`);
    return data;
  }

  async send(msg: MailMessage): Promise<void> {
    await this.call({ action: 'send', to: msg.to, subject: msg.subject, text: msg.text, name: process.env.MAIL_FROM_NAME ?? 'HwWach' });
  }

  // проверка доступности и остаток суточной квоты — в лог ежесуточной задачи
  async keepAlive(): Promise<void> {
    const data = await this.call({ action: 'ping' });
    this.logger.log(`Apps Script: остаток квоты на сегодня ${data.quota}`);
  }
}

// Драйвер задаётся явно. Раньше без MAIL_DRIVER молча включался console — если переменная терялась
// на Render, коды уходили в лог и никто об этом не знал. Теперь сервер не стартует, и деплой падает с понятной ошибкой
const REQUIRED_ENV: Record<string, string[]> = {
  appsscript: ['APPS_SCRIPT_URL', 'APPS_SCRIPT_SECRET'],
  gmail: [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'MAIL_FROM',
  ],
  console: [],
};

export function createMailSender(): MailSender {
  const driver = process.env.MAIL_DRIVER?.trim();
  if (!driver || !Object.hasOwn(REQUIRED_ENV, driver)) {
    throw new Error(
      `MAIL_DRIVER ${driver ? `«${driver}» не поддерживается` : 'не задан'}: укажите appsscript, gmail или console (console — письма только в лог, для локального запуска)`,
    );
  }
  const missing = REQUIRED_ENV[driver].filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(`MAIL_DRIVER=${driver}: не заданы ${missing.join(', ')}`);
  }
  new Logger('Mail').log(
    `Драйвер почты: ${driver}${driver === 'console' ? ' — письма только в лог' : ''}`,
  );
  switch (driver) {
    case 'appsscript':
      return new AppsScriptMailSender();
    case 'gmail':
      return new GmailMailSender();
    default:
      return new ConsoleMailSender();
  }
}
