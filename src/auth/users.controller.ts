import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { AccountsService } from '../users/accounts.service';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { AuthService } from './auth.service';

// Прежние пути профиля: их читают Android и десктоп. Сами учётные записи — /accounts.
// Контроллер живёт в AuthModule: смене пароля нужны новые токены
@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Профиль учётной записи (свой или с правом accounts.manage)' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounts.getProfile(user, id);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Сменить свой пароль. Возвращает новую пару токенов: прежние refresh отозваны' })
  @ApiResponse({ status: 400, description: 'Неверный старый пароль' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    const account = await this.accounts.changePassword(user.id, dto.oldPassword, dto.newPassword);
    return { message: 'Password changed successfully', ...this.auth.login(account) };
  }
}
