import { IsNotEmpty, IsString, IsPhoneNumber, Length, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from '../../decorators/trim.decorator';

// Регистрация человека в организации: по коду приглашения или через поиск (9.1)
export class RegisterDto {
  @ApiProperty({ example: 'newuser', description: 'Логин пользователя' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  login: string;

  @ApiProperty({ example: 'strongPassword123!', description: 'Пароль (4-100 символов)' })
  @IsString()
  @IsNotEmpty()
  @Length(4, 100)
  password: string;

  @ApiPropertyOptional({ description: 'Организация, найденная поиском' })
  @ValidateIf((o) => !o.inviteCode)
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ example: 'K7M-42Q', description: 'Код или токен приглашения' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(4, 128)
  inviteCode?: string;

  @ApiPropertyOptional({ example: '+375291234567', description: 'Номер телефона (опционально)' })
  @IsPhoneNumber('BY')
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Иванов', description: 'Фамилия (по приглашению из карточки — уже заполнена)' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Иван' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванович' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Менеджер' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  position?: string;
}
