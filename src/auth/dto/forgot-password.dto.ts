import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

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
