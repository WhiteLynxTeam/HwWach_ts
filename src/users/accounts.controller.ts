import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccountsService } from './accounts.service';
import { AdminHandoverService } from './admin-handover.service';
import { AdminHandoverDto, CreateAccountDto, HandoverCodeDto, ResetAccountPasswordDto, UpdateAccountDto } from './dto/accounts.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';

@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly handover: AdminHandoverService,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'Системные роли и их права' })
  async roles() {
    return this.accounts.listRoles();
  }

  @Get()
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Учётные записи организации' })
  async list(@CurrentUser() user: AuthUser) {
    return this.accounts.list(user.org);
  }

  @Post()
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Завести учётную запись (временный пароль, смена при первом входе)' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto, @Req() req: Request) {
    return this.accounts.createByAdmin(user, dto, clientIp(req));
  }

  @Put(':id')
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Роль, активность, срок доступа, логин, почта' })
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAccountDto, @Req() req: Request) {
    return this.accounts.update(user, id, dto, clientIp(req));
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Сбросить пароль на временный' })
  async resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResetAccountPasswordDto, @Req() req: Request) {
    return this.accounts.resetPassword(user, id, dto.password, clientIp(req));
  }

  @Post('admin-handover/send-code')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Передача администрирования: код на почту нового админа' })
  async handoverCode(@CurrentUser() user: AuthUser, @Body() dto: HandoverCodeDto, @Req() req: Request) {
    return this.handover.sendCode(user, dto.email, clientIp(req));
  }

  @Post('admin-handover')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiOperation({ summary: 'Передать администрирование: учётка остаётся, меняется человек, логин и почта' })
  async doHandover(@CurrentUser() user: AuthUser, @Body() dto: AdminHandoverDto, @Req() req: Request) {
    return this.handover.handover(user, dto, clientIp(req));
  }
}
