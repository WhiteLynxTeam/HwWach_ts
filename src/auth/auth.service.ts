import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account } from '../entities/account.entity';
import { AccountsService } from '../users/accounts.service';
import { OrgActivityService } from '../core/org-activity.service';
import { getConfig } from '../config/configuration';

// Токены (5): access короткий и несёт права, refresh — только id учётки и token_version.
// На каждом refresh права заново читаются из БД, отключённые учётки и организации отсекаются.
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly cfg = getConfig().jwt;

  constructor(
    private accounts: AccountsService,
    private jwtService: JwtService,
    private activity: OrgActivityService,
  ) {}

  private parseExpiration(timeStr: string): number | string {
    return /^\d+$/.test(timeStr) ? parseInt(timeStr, 10) : timeStr;
  }

  // '10m' → 600; число — уже секунды
  private seconds(timeStr: string): number {
    const m = /^(\d+)\s*([smhd]?)$/.exec(timeStr.trim());
    if (!m) return 600;
    const mult = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2]] ?? 1;
    return parseInt(m[1], 10) * mult;
  }

  accessToken(a: Account): string {
    const role = this.accounts.role(a.systemRoleId);
    const payload = {
      sub: a.id,
      login: a.login,
      org: a.organizationId,
      person: a.personId,
      role: role.code,
      perms: role.perms,
      mol: a.person?.isMol ?? false,
      typ: 'access',
    };
    let expiresIn = this.seconds(this.cfg.accessExpiresIn);
    // exp access не позже срока доступа учётной записи
    if (a.accessExpiresAt) {
      const left = Math.floor((a.accessExpiresAt.getTime() - Date.now()) / 1000);
      expiresIn = Math.max(1, Math.min(expiresIn, left));
    }
    return this.jwtService.sign(payload, { expiresIn });
  }

  refreshToken(a: Account): string {
    return this.jwtService.sign(
      { sub: a.id, typ: 'refresh', ver: a.tokenVersion },
      { expiresIn: this.parseExpiration(this.cfg.refreshExpiresIn) as any },
    );
  }

  login(a: Account) {
    return {
      access_token: this.accessToken(a),
      refresh_token: this.refreshToken(a),
      user: this.accounts.profile(a),
    };
  }

  async refresh(token: string) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (decoded?.typ !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException('Invalid token');
    }
    const a = await this.accounts.loadFull(decoded.sub);
    if (!a || a.tokenVersion !== decoded.ver) {
      throw new UnauthorizedException('Сессия отозвана, войдите снова');
    }
    const reason = this.accounts.unusableReason(a);
    if (reason) {
      throw new UnauthorizedException(reason);
    }
    await this.activity.touch(a.organizationId);
    return {
      access_token: this.accessToken(a),
      refresh_token: this.refreshToken(a),
      user: this.accounts.profile(a),
    };
  }

  async me(accountId: string) {
    const a = await this.accounts.loadFull(accountId);
    if (!a) throw new UnauthorizedException();
    return this.accounts.profile(a);
  }
}
