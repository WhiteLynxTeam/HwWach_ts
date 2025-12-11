import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'userLogin', description: 'Логин пользователя' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль пользователя' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
