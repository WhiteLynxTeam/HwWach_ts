import { IsEnum, IsOptional, IsString, IsPhoneNumber, Length, Matches } from 'class-validator';
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

  @IsPhoneNumber('RU')
  @Matches(/^\+7-\d{3}-\d{3}-\d{2}-\d{2}$/, {
    message: 'Phone number must be in the format +7-XXX-XXX-XX-XX'
  })
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  fullName?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsOptional()
  isActive?: boolean;
}