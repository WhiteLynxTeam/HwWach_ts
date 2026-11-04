import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'userLogin', description: 'Логин пользователя' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль пользователя' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: '482 913 5', description: 'Номер организации (9.2): логин уникален только внутри неё. Без номера — вход по почте или по логину, если он один во всей системе' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizationNumber?: string;
}
