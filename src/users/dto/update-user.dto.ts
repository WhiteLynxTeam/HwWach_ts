import { IsEnum, IsOptional, IsString, IsPhoneNumber, Length } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Length(3, 50)
  login?: string;

  @IsString()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @IsPhoneNumber('BY')
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsOptional()
  isActive?: boolean;
}
