import { IsNotEmpty, IsString, IsPhoneNumber, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'newuser', description: 'Логин пользователя' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль (4-100 символов)' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 100)
  password: string;

  @ApiProperty({ example: '+375291234567', description: 'Номер телефона (опционально)', required: false })
  @IsPhoneNumber('BY')
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Иванов', description: 'Фамилия пользователя' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @ApiProperty({ example: 'Иван', description: 'Имя пользователя' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @ApiProperty({ example: 'Иванович', description: 'Отчество', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  middleName?: string;

  @ApiProperty({ example: 'Менеджер', description: 'Должность', required: false })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  position?: string;
}