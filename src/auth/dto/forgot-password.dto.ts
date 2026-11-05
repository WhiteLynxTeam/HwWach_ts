import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, Length, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../decorators/trim.decorator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'userLogin', description: 'Логин пользователя' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiPropertyOptional({ example: '482 913 1', description: 'Номер организации (9.2): логин уникален только внутри неё. Без номера — вход по почте или по логину, если он один во всей системе' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizationNumber?: string;
}

// Сброс кодом на почту (8.2): шаг 1 — письмо с кодом
export class PasswordResetSendCodeDto {
  @ApiProperty({ example: 'ivanov@pushcha.by' })
  @Trim()
  @IsEmail()
  email: string;
}

// Шаг 2 — код и новый пароль
export class PasswordResetConfirmDto {
  @ApiProperty({ example: 'ivanov@pushcha.by' })
  @Trim()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @MinLength(4)
  newPassword: string;
}
