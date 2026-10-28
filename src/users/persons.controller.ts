import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { PersonsService } from './persons.service';
import { ChangeRequestsService } from './change-requests.service';
import { PersonDto, SetMolDto } from './dto/accounts.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';

@ApiTags('Persons')
@Controller('persons')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@ApiBearerAuth()
export class PersonsController {
  constructor(
    private readonly persons: PersonsService,
    private readonly changes: ChangeRequestsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Люди организации. Без persons.manage — только ФИО, должность, МОЛ' })
  @ApiQuery({ name: 'includeDismissed', required: false, type: Boolean })
  async list(@CurrentUser() user: AuthUser, @Query('includeDismissed') includeDismissed?: string) {
    return this.persons.list(user, includeDismissed === 'true');
  }

  @Post('me/mol-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Попросить признак МОЛ — утверждает админ' })
  async molRequest(@CurrentUser() user: AuthUser) {
    return this.changes.request(user, { isMol: true });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.persons.get(user, id);
  }

  @Post()
  @RequirePerms(Perm.PERSONS_MANAGE, Perm.PERSONS_CREATE_BASIC)
  @ApiOperation({ summary: 'Завести человека без учётной записи (админ; МОЛ — только ФИО и должность)' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: PersonDto, @Req() req: Request) {
    return this.persons.create(user, dto, clientIp(req));
  }

  @Put(':id')
  @RequirePerms(Perm.PERSONS_MANAGE)
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PersonDto, @Req() req: Request) {
    return this.persons.update(user, id, dto, clientIp(req));
  }

  @Post(':id/mol')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.PERSONS_MANAGE)
  @ApiOperation({ summary: 'Поставить / снять признак МОЛ (снять — только если за человеком ничего не числится)' })
  async setMol(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetMolDto, @Req() req: Request) {
    return this.persons.setMol(user, id, dto.isMol, clientIp(req));
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.PERSONS_MANAGE)
  @ApiOperation({ summary: 'Уволить: роли «работает с активом» закрываются, учётная запись отключается' })
  async dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.persons.dismiss(user, id, clientIp(req));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePerms(Perm.PERSONS_MANAGE)
  @ApiOperation({ summary: 'Вернуть уволенного (учётная запись остаётся отключённой)' })
  async restore(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.persons.restore(user, id, clientIp(req));
  }
}
