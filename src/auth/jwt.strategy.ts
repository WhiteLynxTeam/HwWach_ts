import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { getConfig } from '../config/configuration';
import { AuthUser } from '../common/auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const config = getConfig();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
    });
  }

  // refresh-токен как access не подходит (5)
  async validate(payload: any): Promise<AuthUser> {
    if (payload?.typ !== 'access' || !payload.org || !payload.person) {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.sub,
      login: payload.login,
      org: payload.org,
      person: payload.person,
      role: payload.role,
      perms: payload.perms ?? [],
      mol: !!payload.mol,
    };
  }
}
