import {
  Controller,
  Post,
  Request,
  UseGuards,
  Body,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login to the system' })
  @ApiResponse({ status: 200, description: 'Successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Successfully refreshed token.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async refresh(@Body('refresh_token') refreshToken: string) {
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
}