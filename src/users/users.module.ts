import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { PendingRegistration } from './entities/pending-registration.entity';
import { PendingChanges } from './entities/pending-changes.entity';
import { PendingResetPass } from './entities/pending-reset-pass.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RegistrationsController } from './registrations.controller';
import { UserChangeRequestsController } from './user-change-requests.controller';
import { RegistrationStatusController } from './registration-status.controller';
import { ResetPassController } from './reset-pass.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, PendingRegistration, PendingChanges, PendingResetPass])],
  providers: [UsersService],
  controllers: [
    UsersController,
    RegistrationsController,
    UserChangeRequestsController,
    RegistrationStatusController,
    ResetPassController,
  ],
  exports: [UsersService],
})
export class UsersModule {
  constructor() {
    console.log('✅ UsersModule initialized');
  }
}