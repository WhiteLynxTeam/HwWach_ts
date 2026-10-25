import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PersonsService } from './persons.service';
import { RegistrationsService } from './registrations.service';
import { ChangeRequestsService } from './change-requests.service';
import { AdminHandoverService } from './admin-handover.service';
import { AccountsController } from './accounts.controller';
import { PersonsController } from './persons.controller';
import { RegistrationsController } from './registrations.controller';
import { RegistrationStatusController } from './registration-status.controller';
import { ResetPassController } from './reset-pass.controller';
import { UserChangeRequestsController } from './user-change-requests.controller';

// Люди, учётные записи и заявки, которые утверждает админ организации
@Module({
  providers: [AccountsService, PersonsService, RegistrationsService, ChangeRequestsService, AdminHandoverService],
  controllers: [
    AccountsController,
    PersonsController,
    RegistrationsController,
    RegistrationStatusController,
    ResetPassController,
    UserChangeRequestsController,
  ],
  exports: [AccountsService, PersonsService, RegistrationsService, ChangeRequestsService],
})
export class UsersModule {}
