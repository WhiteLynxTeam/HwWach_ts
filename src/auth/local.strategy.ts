import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountsService } from '../users/accounts.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private accounts: AccountsService) {
    super({ usernameField: 'login' });
  }

  async validate(login: string, password: string): Promise<any> {
    const account = await this.accounts.validateLogin(login, password);
    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return account;
  }
}
