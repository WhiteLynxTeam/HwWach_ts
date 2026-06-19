import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'userLogin', description: 'Логин пользователя' })
  @IsNotEmpty()
  @IsString()
  login: string;
}
