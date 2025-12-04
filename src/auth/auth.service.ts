import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(login: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(login, password);
    if (user) {
      // Log successful authentication
      this.logger.log(`Successful login attempt for user: ${login}`);
      return user;
    }

    // Log failed authentication
    this.logger.warn(`Failed login attempt for user: ${login}`);
    return null;
  }

  async login(user: any) {
    const payload = { login: user.login, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: this.parseExpirationTime(process.env.JWT_EXPIRATION_TIME ?? '15m') as any
      }),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: this.parseExpirationTime(process.env.JWT_REFRESH_EXPIRATION_TIME ?? '7d') as any
      }),
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(user: any) {
    const payload = { login: user.login, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: this.parseExpirationTime(process.env.JWT_EXPIRATION_TIME ?? '15m') as any
      }),
    };
  }

  private parseExpirationTime(timeStr: string): number | string {
    if (timeStr.match(/^\d+$/)) {
      return parseInt(timeStr, 10);
    }
    return timeStr;
  }
}