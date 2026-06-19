import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldPassword123', description: 'Текущий (старый) пароль пользователя' })
  @IsNotEmpty()
  @IsString()
  oldPassword?: string;

  @ApiProperty({ example: 'newPassword123', description: 'Новый пароль пользователя' })
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  newPassword: string;
}
