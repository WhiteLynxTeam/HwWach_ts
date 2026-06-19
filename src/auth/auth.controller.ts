import {
  Controller,
  Post,
  Request,
  UseGuards,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { ApiTags, ApiResponse, ApiOperation, ApiBody } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginResponseDto, RefreshResponseDto, ErrorResponseDto, UserResponseDto, PasswordChangeRequiredResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UsersService } from '../users/users.service';
import { PendingRegistration } from '../users/entities/pending-registration.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangeTempPasswordDto } from '../users/dto/change-temp-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login to the system' })
  @ApiResponse({ status: 200, description: 'Successfully logged in.', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto })
  @ApiResponse({ status: 412, description: 'Необходимо сменить временный пароль перед авторизацией.', type: PasswordChangeRequiredResponseDto })
  @ApiBody({
    description: 'Login credentials',
    type: LoginDto,
  })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'Successfully registered a new user request.', type: PendingRegistration })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiBody({
    description: 'Registration data',
    type: RegisterDto,
  })
  async register(@Body() registerDto: RegisterDto): Promise<Omit<PendingRegistration, 'password'>> {
    return this.usersService.registerUser(registerDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Successfully refreshed token.',
    type: RefreshResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing refresh token.',
    type: ErrorResponseDto,
  })
  @ApiBody({
    description: 'Refresh token',
    type: RefreshTokenDto,
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const { refresh_token: refreshToken } = refreshTokenDto;
    // In a real application, you would verify the refresh token
    // For now, we'll simulate a refresh based on the payload
    try {
      const decoded = this.authService['jwtService'].decode(refreshToken) as any;
      if (!decoded) {
        return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Invalid token' };
      }

      // Simulate getting user info from token
      const user = {
        id: decoded.sub,
        login: decoded.login,
        role: decoded.role,
      };

      return this.authService.refresh(user);
    } catch (error) {
      return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Invalid token' };
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset (forgot password)' })
  @ApiResponse({ status: 200, description: 'Reset request successfully created.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Active reset request already exists.' })
  @ApiBody({
    description: 'User login for password reset',
    type: ForgotPasswordDto,
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.usersService.requestPasswordReset(forgotPasswordDto.login);
  }

  @Post('change-temp-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change temporary password (Public endpoint)' })
  @ApiResponse({ status: 200, description: 'Password successfully changed.' })
  @ApiResponse({ status: 400, description: 'Bad Request (invalid credentials, or password reset not required).' })
  @ApiBody({
    description: 'Temporary password reset details',
    type: ChangeTempPasswordDto,
  })
  async changeTempPassword(@Body() changeTempPasswordDto: ChangeTempPasswordDto): Promise<{ message: string }> {
    await this.usersService.changeTempPassword(changeTempPasswordDto);
    return { message: 'Password changed successfully' };
  }
}