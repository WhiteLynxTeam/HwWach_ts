import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUUID, Length,
  ValidateIf, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Trim } from '../../decorators/trim.decorator';
import { RoleCode } from '../../common/permissions';

// admin руками не назначается — только передачей администрирования
const ASSIGNABLE_ROLES = [RoleCode.ASSET_MANAGER, RoleCode.REVIEWER, RoleCode.MEMBER, RoleCode.OBSERVER];

// Админ сам заводит учётную запись (вариант «В», 9.1): существующему человеку или новому
export class CreateAccountDto {
  @ApiPropertyOptional({ description: 'Существующий человек; иначе передайте ФИО' })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.personId)
  @Trim()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.personId)
  @Trim()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber('BY')
  phone?: string;

  @ApiProperty({ example: 'ivanov' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  login: string;

  @ApiPropertyOptional({ description: 'Временный пароль; пусто — пароль по умолчанию или случайный' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES, default: RoleCode.MEMBER })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  roleCode?: string;

  @ApiPropertyOptional({ description: 'Срок доступа (ISO)' })
  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  roleCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Срок доступа (ISO) или null — бессрочно', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.accessExpiresAt !== null)
  @IsDateString()
  accessExpiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 255)
  login?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.email !== null)
  @IsEmail()
  email?: string | null;
}

export class ResetAccountPasswordDto {
  @ApiPropertyOptional({ description: 'Новый временный пароль; пусто — по умолчанию или случайный' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class HandoverCodeDto {
  @ApiProperty({ example: 'new.admin@mail.ru' })
  @IsEmail()
  email: string;
}

export class NewPersonDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @Length(2, 50)
  lastName: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @Length(2, 50)
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  position?: string;
}

export class AdminHandoverDto {
  @ApiPropertyOptional({ description: 'Новый админ из уже заведённых людей' })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional({ type: NewPersonDto, description: 'Или новый человек' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewPersonDto)
  newPerson?: NewPersonDto;

  @ApiProperty({ description: 'Новый логин (по умолчанию — почта нового админа)' })
  @Trim()
  @IsString()
  @Length(3, 255)
  login: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ default: true, description: 'Сменить почту организации на почту нового админа' })
  @IsOptional()
  @IsBoolean()
  changeOrgEmail?: boolean;

  @ApiProperty({ description: 'Пароль текущего админа' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}

export class PersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 50)
  firstName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  middleName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Признак МОЛ (только с правом persons.manage)' })
  @IsOptional()
  @IsBoolean()
  isMol?: boolean;
}

export class SetMolDto {
  @ApiProperty()
  @IsBoolean()
  isMol: boolean;
}

export class ApproveRegistrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Привязать к уже заведённому человеку' })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  roleCode?: string;
}
