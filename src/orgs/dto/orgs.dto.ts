import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Trim } from '../../decorators/trim.decorator';
import { RoleCode } from '../../common/permissions';

export class SendCodeDto {
  @ApiProperty({ example: 'office@pushcha.by' })
  @Trim()
  @IsEmail()
  email: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: 'office@pushcha.by' })
  @Trim()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @Trim()
  @IsString()
  @Length(6, 6)
  code: string;
}

// Шаг 3 мастера (8.1): организация и её первый администратор
export class CompleteOrgRegistrationDto {
  @ApiProperty({ description: 'Выдан на шаге 2' })
  @IsString()
  @IsNotEmpty()
  registration_token: string;

  @ApiProperty({ example: 'ОАО «Беловежская пуща»' })
  @Trim()
  @IsString()
  @Length(2, 255)
  name: string;

  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(1, 100) shortName?: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(1, 500) address?: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(1, 150) directorName?: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(1, 150) ownerName?: string;

  @ApiProperty({ example: 'Иванов' }) @Trim() @IsString() @Length(2, 50) lastName: string;
  @ApiProperty({ example: 'Иван' }) @Trim() @IsString() @Length(2, 50) firstName: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 50) middleName?: string;
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 100) position?: string;

  @ApiProperty({ description: 'Пароль администратора (4-100 символов)' })
  @IsString()
  @Length(4, 100)
  password: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @Trim() @IsString() @Length(2, 255) name?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() shortName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() address?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() directorName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() ownerName?: string | null;
}

const INVITE_ROLES = [RoleCode.ASSET_MANAGER, RoleCode.REVIEWER, RoleCode.MEMBER, RoleCode.OBSERVER];

export class CreateInviteDto {
  @ApiPropertyOptional({ description: 'Приглашение из карточки уже заведённого человека' })
  @IsOptional()
  @IsUUID()
  personId?: string;

  @ApiPropertyOptional({ enum: INVITE_ROLES, default: RoleCode.MEMBER })
  @IsOptional()
  @IsIn(INVITE_ROLES)
  roleCode?: string;

  @ApiPropertyOptional({ default: 1, description: 'Общая ссылка «на N человек»' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;
}
