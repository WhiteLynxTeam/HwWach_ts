import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Данные из access-токена (5). person / org берутся из токена в момент действия,
// а не через accounts.person_id: после передачи админства старый токен подписывает действия прежним человеком
export interface AuthUser {
  id: string; // account_id
  login: string;
  org: string;
  person: string;
  role: string;
  perms: string[];
  mol: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export function hasPerm(user: AuthUser | undefined, perm: string): boolean {
  return !!user?.perms?.includes(perm);
}
