import { Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './auth-user';

const PERMS_KEY = 'perms';

// В коде проверяем право, а не роль (2.4). Нужно любое из перечисленных прав.
export const RequirePerms = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);

@Injectable()
export class PermsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) {
      return true;
    }
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user || !required.some((p) => user.perms?.includes(p))) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
