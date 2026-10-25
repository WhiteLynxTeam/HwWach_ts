import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

// Внутренние запросы go ↔ ts и будильник ежесуточной задачи (5.1, 8.7):
// общий ключ INTERNAL_API_KEY в заголовке X-Internal-Key, пользовательский токен не подходит
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_API_KEY;
    const got = context.switchToHttp().getRequest().headers['x-internal-key'];
    if (!expected || typeof got !== 'string') {
      throw new UnauthorizedException('Internal key required');
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(got);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal key');
    }
    return true;
  }
}
