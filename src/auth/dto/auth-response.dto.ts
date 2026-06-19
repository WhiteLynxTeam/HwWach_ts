import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'userLogin' })
  login: string;

  @ApiPropertyOptional({ example: 'Иван' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванов' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Иванович' })
  middleName?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Invalid token' })
  message: string;
}

export class PasswordChangeRequiredResponseDto {
  @ApiProperty({ example: 412 })
  statusCode: number;

  @ApiProperty({ example: 'Необходимо сменить временный пароль перед авторизацией' })
  message: string;

  @ApiProperty({ example: 'PASSWORD_CHANGE_REQUIRED' })
  error_code: string;
}
