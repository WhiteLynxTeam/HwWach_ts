import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AccountsService } from '../users/accounts.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private accounts: AccountsService) {
    // Номер организации (9.2) — из тела запроса рядом с логином и паролем
    super({ usernameField: 'login', passReqToCallback: true });
  }

  async validate(req: Request, login: string, password: string): Promise<any> {
    const orgNumber = typeof req.body?.organizationNumber === 'string' ? req.body.organizationNumber : null;
    const account = await this.accounts.validateLogin(login, password, orgNumber);
    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return account;
  }
}
