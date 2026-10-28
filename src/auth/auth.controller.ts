import { Controller, Post, Get, Request, UseGuards, Body, HttpStatus, HttpCode, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiResponse, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto, RefreshResponseDto, ErrorResponseDto, PasswordChangeRequiredResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangeTempPasswordDto } from '../users/dto/change-temp-password.dto';
import { RegistrationsService } from '../users/registrations.service';
import { ChangeRequestsService } from '../users/change-requests.service';
import { AccountsService } from '../users/accounts.service';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { clientIp } from '../common/client-ip';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private accounts: AccountsService,
    private registrations: RegistrationsService,
    private changes: ChangeRequestsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login to the system' })
  @ApiResponse({ status: 200, description: 'Successfully logged in.', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Учётная запись отключена, сотрудник уволен или организация заблокирована / удалена.' })
  @ApiResponse({ status: 412, description: 'Необходимо сменить временный пароль перед авторизацией.', type: PasswordChangeRequiredResponseDto })
  @ApiBody({ type: LoginDto })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Заявка на регистрацию в организации (по коду приглашения или найденной организации)' })
  @ApiResponse({ status: 201, description: 'Заявка создана, ждёт решения админа организации.' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto, @Req() req: ExpressRequest) {
    return this.registrations.register(registerDto, clientIp(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить токены. Права перечитываются из БД; отключённые учётки и организации — 401' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Человек, организация, роль и права текущей учётной записи' })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset (forgot password)' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Active reset request already exists.' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.changes.requestReset(dto.login);
  }

  @Post('change-temp-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change temporary password (Public endpoint)' })
  @ApiBody({ type: ChangeTempPasswordDto })
  async changeTempPassword(@Body() dto: ChangeTempPasswordDto): Promise<{ message: string }> {
    await this.accounts.changeTempPassword(dto.login, dto.oldPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }
}
