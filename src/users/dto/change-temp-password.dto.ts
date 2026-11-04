import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional, MaxLength } from 'class-validator';

export class ChangeTempPasswordDto {
  @ApiProperty({ example: 'ivanov_77', description: 'Логин пользователя' })
  @IsNotEmpty()
  @IsString()
  login: string;

  @ApiProperty({ example: 'tempPassword123', description: 'Текущий временный пароль пользователя' })
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'newPassword123', description: 'Новый пароль пользователя' })
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  newPassword: string;

  @ApiPropertyOptional({ example: '482 913 5', description: 'Номер организации (9.2): логин уникален только внутри неё. Без номера — вход по почте или по логину, если он один во всей системе' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizationNumber?: string;
}
