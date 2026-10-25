import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrganizationsService } from './organizations.service';
import { InvitesService } from './invites.service';
import { JobsService } from './jobs.service';
import { CompleteOrgRegistrationDto, CreateInviteDto, SendCodeDto, UpdateOrganizationDto, VerifyCodeDto } from './dto/orgs.dto';
import { CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PermsGuard, RequirePerms } from '../common/perms.guard';
import { InternalKeyGuard } from '../common/internal-key.guard';
import { Perm } from '../common/permissions';
import { clientIp } from '../common/client-ip';
import { AuditService } from '../core/audit.service';
import { OrgActivityService } from '../core/org-activity.service';
import { PersonsService } from '../users/persons.service';

// Регистрация организации — мастер из трёх шагов (8.1)
@ApiTags('Organization registration')
@Controller('org-registration')
export class OrgRegistrationController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Шаг 1: письмо с 6-значным кодом (ответ одинаковый, занят адрес или нет)' })
  async sendCode(@Body() dto: SendCodeDto, @Req() req: Request) {
    return this.orgs.sendRegistrationCode(dto.email, clientIp(req));
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Шаг 2: код верный → registration_token на 30 минут' })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.orgs.verifyRegistrationCode(dto.email, dto.code);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Шаг 3: организация + администратор (логин = почта) → сразу вход' })
  async complete(@Body() dto: CompleteOrgRegistrationDto, @Req() req: Request) {
    return this.orgs.completeRegistration(dto, clientIp(req));
  }
}

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Поиск организации при регистрации: от 4 символов, без подсказок, до 20 результатов' })
  @ApiQuery({ name: 'q', required: true })
  async search(@Query('q') q: string, @Req() req: Request) {
    return this.orgs.search(q, clientIp(req));
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return this.orgs.me(user);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'), PermsGuard)
  @RequirePerms(Perm.ORG_MANAGE)
  @ApiBearerAuth()
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto, @Req() req: Request) {
    return this.orgs.update(user, dto, clientIp(req));
  }
}

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get('resolve/:code')
  @ApiOperation({ summary: 'Публично: организация (и человек) за кодом или токеном приглашения' })
  async resolve(@Param('code') code: string, @Req() req: Request) {
    return this.invites.resolve(code, clientIp(req));
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermsGuard)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать приглашение: ссылка, короткий код и текст для «Поделиться»' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto, @Req() req: Request) {
    return this.invites.create(user, dto, clientIp(req));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermsGuard)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiBearerAuth()
  async list(@CurrentUser() user: AuthUser) {
    return this.invites.list(user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermsGuard)
  @RequirePerms(Perm.ACCOUNTS_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отозвать приглашение' })
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.invites.revoke(user, id, clientIp(req));
  }
}

// Страница по ссылке из мессенджера
@Controller('invite')
export class InvitePageController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  async page(@Param('token') token: string) {
    return this.invites.page(token);
  }
}

@ApiTags('Audit')
@Controller('audit')
@UseGuards(AuthGuard('jwt'), PermsGuard)
@RequirePerms(Perm.AUDIT_VIEW)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Журнал ts (люди, учётки, регистрации, организация). Журнал активов — в go' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'before', required: false, description: 'ISO-время: записи раньше него' })
  @ApiQuery({ name: 'objectId', required: false })
  async list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string, @Query('before') before?: string, @Query('objectId') objectId?: string) {
    return this.audit.list(user.org, { limit: limit ? parseInt(limit, 10) : undefined, before: before ? new Date(before) : undefined, objectId });
  }
}

// Внутренние запросы go → ts и будильник (5.1, 8.7)
@Controller('internal')
@UseGuards(InternalKeyGuard)
export class InternalController {
  constructor(
    private readonly persons: PersonsService,
    private readonly activity: OrgActivityService,
    private readonly jobs: JobsService,
  ) {}

  @Get('persons/:id')
  @ApiExcludeEndpoint()
  async person(@Param('id') id: string) {
    return this.persons.internalGet(id);
  }

  @Post('organizations/:id/filled')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async filled(@Param('id') id: string) {
    await this.activity.markFilled(id);
    await this.activity.touch(id);
    return { ok: true };
  }

  @Post('organizations/:id/touch')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async touch(@Param('id') id: string) {
    await this.activity.touch(id);
    return { ok: true };
  }

  @Post('jobs/daily')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async daily() {
    return this.jobs.daily();
  }

  @Get('jobs/last')
  @ApiExcludeEndpoint()
  async last() {
    return this.jobs.lastRun();
  }
}
