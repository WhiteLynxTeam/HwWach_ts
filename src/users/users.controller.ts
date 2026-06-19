  import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    HttpStatus,
  } from '@nestjs/common';
import { UsersService } from './users.service';
import { User} from './entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import { ApiBearerAuth, ApiTags, ApiResponse, ApiOperation, ApiExtraModels } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PendingRegistration } from './entities/pending-registration.entity';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiExtraModels(PendingRegistration)
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return all users.', type: [User] })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async findAll(): Promise<Omit<User, 'password'>[]> {
    return await this.usersService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'The user has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async create(@Body() createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // Omit password from response
    const { password, ...user } = await this.usersService.create(createUserDto);
    return user;
  }

  @Get('registrations')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all pending registrations (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return all pending registrations.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getPendingRegistrations(): Promise<Array<Omit<PendingRegistration, 'password'>>> {
    const registrations = await this.usersService.getPendingRegistrations();
    return registrations.map(({ password, ...rest }) => rest);
  }

  @Get('registrations/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a pending registration by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Return the pending registration.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Registration request not found.' })
  async getRegistrationById(@Param('id') id: string): Promise<Omit<PendingRegistration, 'password'>> {
    const registration = await this.usersService.getRegistrationById(id);
    const { password, ...result } = registration;
    return result;
  }

  @Post('registrations/:id/approve')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
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

  @Post('registrations/:id/reject')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'Return the user.', type: User })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(@Param('id') id: string): Promise<Omit<User, 'password'>> {
    return await this.usersService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'The user has been successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    // Omit password from response
    const { password, ...user } = await this.usersService.update(id, updateUserDto);
    return user;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete/deactivate a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'The user has been successfully deactivated.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.usersService.remove(id);
    return { message: 'User deactivated successfully' };
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own password' })
  @ApiResponse({ status: 200, description: 'Password successfully changed.' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid old password or validation error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(req.user.id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }
}
