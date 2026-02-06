import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { RequestUserChangeDto } from './dto/request-user-change.dto';
import { PendingChanges } from './entities/pending-changes.entity';

@ApiTags('User Change Requests')
@Controller('user-change-requests')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UserChangeRequestsController {
  constructor(private readonly usersService: UsersService) {}

  @Post('request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request to change user data' })
  @ApiResponse({
    status: 201,
    description: 'Change request successfully created.',
    type: PendingChanges
  })
  async requestChange(
    @Request() req,
    @Body() requestUserChangeDto: RequestUserChangeDto
  ): Promise<PendingChanges> {
    console.log('User ID from token:', req.user.id);
    console.log('User login from token:', req.user.login);
    return await this.usersService.requestUserChange(req.user.id, requestUserChangeDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all change requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all change requests.',
    type: [PendingChanges]
  })
  async getAllChangeRequests(): Promise<PendingChanges[]> {
    return await this.usersService.getAllChangeRequests();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific change request (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a specific change request.',
    type: PendingChanges
  })
  @ApiResponse({ status: 404, description: 'Change request not found.' })
  async getChangeRequest(@Param('id') id: string): Promise<PendingChanges> {
    return await this.usersService.getChangeRequestById(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a change request (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Change request successfully approved.',
    type: PendingChanges
  })
  @ApiResponse({ status: 400, description: 'Cannot approve request.' })
  @ApiResponse({ status: 404, description: 'Change request not found.' })
  async approveChangeRequest(
    @Param('id') id: string,
    @Body('comment') comment?: string,
    @Request() req?: any
  ): Promise<PendingChanges> {
    return await this.usersService.approveChangeRequest(id, req?.user?.id, comment);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a change request (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Change request successfully rejected.',
    type: PendingChanges
  })
  @ApiResponse({ status: 400, description: 'Cannot reject request.' })
  @ApiResponse({ status: 404, description: 'Change request not found.' })
  async rejectChangeRequest(
    @Param('id') id: string,
    @Body('reason') reason?: string
  ): Promise<PendingChanges> {
    return await this.usersService.rejectChangeRequest(id, reason);
  }
}