import { IsEnum, IsNotEmpty, IsString, IsPhoneNumber, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'user123', description: 'Логин пользователя' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль (6-100 символов)' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
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

  @ApiProperty({ 
    enum: UserRole,
    example: UserRole.USER,
    description: 'Роль в системе'
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
