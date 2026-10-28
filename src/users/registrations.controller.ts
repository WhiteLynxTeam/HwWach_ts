import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { RegistrationsService } from './registrations.service';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { ApproveRegistrationDto } from './dto/accounts.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';

// Заявки на регистрацию в организации — утверждает только админ этой организации (9.1)
@ApiTags('Registrations')
@Controller('registrations')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@RequirePerms(Perm.ACCOUNTS_MANAGE)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly regs: RegistrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Заявки на регистрацию, ожидающие решения' })
  async list(@CurrentUser() user: AuthUser) {
    return this.regs.listPending(user.org);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.regs.get(user.org, id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Одобрить: человек + учётная запись (роль — из приглашения или «Участник»)' })
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApproveRegistrationDto, @Req() req: Request) {
    return this.regs.approve(user, id, dto, clientIp(req));
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Отклонить (причина обязательна)' })
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectRegistrationDto, @Req() req: Request) {
    return this.regs.reject(user, id, dto.reason, clientIp(req));
  }
}
