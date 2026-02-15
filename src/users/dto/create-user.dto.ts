import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
//import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, Length, Matches } from 'class-validator';
import { UserRole } from '../entities/user.entity';
import { Trim } from 'src/decorators/trim.decorator';

export class CreateUserDto {
  @ApiProperty({ example: 'ivan_Иванов77', description: 'Логин (RU/EN, цифры, подчёркивание, минус)' })
  @IsString()
  @Trim()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/)
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль (4-100 символов)' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 100)
  password: string;

  @ApiPropertyOptional({ example: '+375291234567', description: 'Номер телефона (опционально)'})
  //@Transform(({ value }) => value === '' ? null : value)
  @IsPhoneNumber('BY')
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Иванов', description: 'Фамилия пользователя (опционально)' })
  @IsOptional()
  @IsString()
  @Trim()
  @Length(2, 50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Иван', description: 'Имя пользователя  (опционально)' })
  @IsOptional()
  @IsString()
  @Trim()
  @Length(2, 50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванович', description: 'Отчество  (опционально)'})
  //@Transform(({ value }) => value === '' ? null : value)
  @IsOptional()
  @IsString()
  @Trim()
  @Length(2, 50)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Менеджер', description: 'Должность  (опционально)'})
 // @Transform(({ value }) => value === '' ? null : value)
  @IsOptional()
  @IsString()
  @Trim()
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
