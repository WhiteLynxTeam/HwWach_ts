import { Request } from 'express';

// IP клиента — в одном месте для лимитов, журнала и created_ip (8.7).
// Работает только вместе с app.set('trust proxy', N) в main.ts: тогда Express
// сам берёт адрес из X-Forwarded-For, отбросив N доверенных прокси Render.
export function clientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);
}
