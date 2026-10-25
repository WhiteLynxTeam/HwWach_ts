import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { OrganizationsService } from './organizations.service';
import { InvitesService } from './invites.service';
import { JobsService } from './jobs.service';
import {
  AuditController, InternalController, InvitePageController, InvitesController, OrganizationsController, OrgRegistrationController,
} from './orgs.controllers';

// Организации: регистрация, поиск, приглашения, журнал, внутренние запросы и ежесуточная задача
@Module({
  imports: [AuthModule, UsersModule],
  providers: [OrganizationsService, InvitesService, JobsService],
  controllers: [
    OrgRegistrationController,
    OrganizationsController,
    InvitesController,
    InvitePageController,
    AuditController,
    InternalController,
  ],
})
export class OrgsModule {}
