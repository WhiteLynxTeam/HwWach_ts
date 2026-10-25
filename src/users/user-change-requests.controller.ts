import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ChangeRequestsService } from './change-requests.service';
import { RequestUserChangeDto } from './dto/request-user-change.dto';
import { PendingChanges } from '../entities/requests.entity';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';

// Смена профиля и просьба «я МОЛ» — утверждает админ
@ApiTags('User Change Requests')
@Controller('user-change-requests')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@ApiBearerAuth()
export class UserChangeRequestsController {
  constructor(private readonly changes: ChangeRequestsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Запросить изменение своих данных (или признак МОЛ: isMol = true)' })
  @ApiResponse({ status: 201, type: PendingChanges })
  async request(@CurrentUser() user: AuthUser, @Body() dto: RequestUserChangeDto) {
    return this.changes.request(user, dto);
  }

  @Get()
  @RequirePerms(Perm.PERSONS_MANAGE)
  @ApiOperation({ summary: 'Все запросы на изменение (новые сверху)' })
  async list(@CurrentUser() user: AuthUser) {
    return this.changes.list(user.org);
  }

  @Get(':id')
  @RequirePerms(Perm.PERSONS_MANAGE)
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.changes.get(user.org, id);
  }

  @Patch(':id/approve')
  @RequirePerms(Perm.PERSONS_MANAGE)
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('comment') comment: string | undefined, @Req() req: Request) {
    return this.changes.approve(user, id, comment, clientIp(req));
  }

  @Patch(':id/reject')
  @RequirePerms(Perm.PERSONS_MANAGE)
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('reason') reason: string | undefined, @Req() req: Request) {
    return this.changes.reject(user, id, reason, clientIp(req));
  }
}
