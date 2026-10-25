import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import { GetRegistrationStatusResponseDto } from './dto/get-registration-status-response.dto';

@ApiTags('Registration Status')
@Controller('registration-status')
export class RegistrationStatusController {
  constructor(private readonly regs: RegistrationsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get registration status by ID (Public endpoint)' })
  @ApiResponse({ status: 200, description: 'Return the registration status.', type: GetRegistrationStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Registration request not found.' })
  async getRegistrationStatus(@Param('id') id: string) {
    return this.regs.status(id);
  }
}
