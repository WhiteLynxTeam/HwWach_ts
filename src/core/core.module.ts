import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { Person } from '../entities/person.entity';
import { Account } from '../entities/account.entity';
import { Permission, SystemRole } from '../entities/system-role.entity';
import { AccountPersonHistory, AuditLog, EmailCode, JobRun, RateLimitHit } from '../entities/misc.entity';
import { Invite, PendingChanges, PendingRegistration, PendingResetPass } from '../entities/requests.entity';
import { AuditService } from './audit.service';
import { RateLimitService } from './rate-limit.service';
import { GoClientService } from './go-client.service';
import { OrgActivityService } from './org-activity.service';
import { MailSender, createMailSender } from '../mail/mail.service';
import { EmailCodesService } from './email-codes.service';

const entities = TypeOrmModule.forFeature([
  Organization, Person, Account, SystemRole, Permission, AccountPersonHistory, AuditLog, EmailCode, JobRun,
  RateLimitHit, Invite, PendingChanges, PendingRegistration, PendingResetPass,
]);

@Global()
@Module({
  imports: [entities],
  providers: [
    AuditService,
    RateLimitService,
    GoClientService,
    OrgActivityService,
    EmailCodesService,
    { provide: MailSender, useFactory: createMailSender },
  ],
  exports: [entities, AuditService, RateLimitService, GoClientService, OrgActivityService, EmailCodesService, MailSender],
})
export class CoreModule {}
