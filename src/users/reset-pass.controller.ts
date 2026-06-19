import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApproveResetPasswordDto } from './dto/approve-reset-password.dto';
import { PendingResetPass } from './entities/pending-reset-pass.entity';

@ApiTags('Password Reset')
@Controller('reset-pass')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class ResetPassController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pending reset requests (Admin only)' })
  async getPendingRequests(): Promise<PendingResetPass[]> {
    return await this.usersService.getPendingResetRequests();
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve reset request (Admin only)' })
  async approveRequest(
    @Param('id') id: string,
    @Body() approveDto: ApproveResetPasswordDto,
    @Request() req: any,
  ) {
    return await this.usersService.approveResetRequest(id, req.user.id, approveDto.password);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject reset request (Admin only)' })
  async rejectRequest(@Param('id') id: string): Promise<PendingResetPass> {
    return await this.usersService.rejectResetRequest(id);
  }
}
