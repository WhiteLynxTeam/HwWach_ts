import {
  Controller,
  Get,
  Param,
  HttpStatus,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PendingRegistration } from './entities/pending-registration.entity';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { GetRegistrationStatusResponseDto } from './dto/get-registration-status-response.dto';

@ApiTags('Registration Status')
@Controller('registration-status')
export class RegistrationStatusController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiOperation({ summary: 'Get registration status by ID (Public endpoint)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Return the registration status.',
    type: GetRegistrationStatusResponseDto
  })
  @ApiResponse({ status: 404, description: 'Registration request not found.' })
  async getRegistrationStatus(
    @Param('id') id: string
  ): Promise<Omit<PendingRegistration, 'password'>> {
    const registration = await this.usersService.getRegistrationStatusById(id);
    const { password, ...result } = registration;
    return result;
  }
}