import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'id учётной записи' })
  id: string;

  @ApiProperty({ example: 'userLogin' })
  login: string;

  @ApiProperty()
  personId: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  organizationName?: string;

  @ApiPropertyOptional({ example: 'Иван' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванов' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Иванович' })
  middleName?: string;

  @ApiProperty({ example: 'member', description: 'Код системной роли' })
  role: string;

  @ApiProperty({ example: 'Участник' })
  roleName: string;

  @ApiProperty({ example: ['assets.propose'], description: 'Права — по ним клиенты строят меню' })
  perms: string[];

  @ApiProperty({ description: 'Материально ответственное лицо' })
  isMol: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class RefreshResponseDto extends LoginResponseDto {}

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
