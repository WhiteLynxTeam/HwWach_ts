import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

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
}
