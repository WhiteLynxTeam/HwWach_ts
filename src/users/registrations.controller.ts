import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation, ApiExtraModels } from '@nestjs/swagger';
import { PendingRegistration } from './entities/pending-registration.entity';

@ApiTags('Registrations')
@ApiExtraModels(PendingRegistration)
@Controller('registrations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class RegistrationsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all pending registrations (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return all pending registrations.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getPendingRegistrations(): Promise<Array<Omit<PendingRegistration, 'password'>>> {
    const registrations = await this.usersService.getPendingRegistrations();
    return registrations.map(({ password, ...rest }) => rest);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a pending registration by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return the pending registration.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Registration request not found.' })
  async getRegistrationById(@Param('id') id: string): Promise<Omit<PendingRegistration, 'password'>> {
    const registration = await this.usersService.getRegistrationById(id);
    const { password, ...result } = registration;
    return result;
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a pending registration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Successfully approved the registration.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Registration request or user not found.' })
  async approveRegistration(
    @Param('id') id: string,
    @Body('comment') comment?: string,
    @Request() req?: any
  ): Promise<Omit<PendingRegistration, 'password'>> {
    const registration = await this.usersService.approveRegistration(id, req?.user?.id, comment);
    const { password, ...result } = registration;
    return result;
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a pending registration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Successfully rejected the registration.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Registration request not found.' })
  async rejectRegistration(
    @Param('id') id: string,
    @Body('reason') reason?: string
  ): Promise<Omit<PendingRegistration, 'password'>> {
    const registration = await this.usersService.rejectRegistration(id, reason);
    const { password, ...result } = registration;
    return result;
  }
}
