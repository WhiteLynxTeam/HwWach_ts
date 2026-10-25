import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ChangeRequestsService } from './change-requests.service';
import { ApproveResetPasswordDto } from './dto/approve-reset-password.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';

@ApiTags('Password Reset')
@Controller('reset-pass')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@RequirePerms(Perm.ACCOUNTS_MANAGE)
@ApiBearerAuth()
export class ResetPassController {
  constructor(private readonly changes: ChangeRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Заявки на сброс пароля' })
  async list(@CurrentUser() user: AuthUser) {
    return this.changes.listResets(user.org);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Одобрить: временный пароль (заданный или по умолчанию)' })
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApproveResetPasswordDto, @Req() req: Request) {
    return this.changes.approveReset(user, id, dto.password, clientIp(req));
  }

  @Post(':id/reject')
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.changes.rejectReset(user, id);
  }
}
