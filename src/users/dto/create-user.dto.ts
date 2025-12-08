import { IsEnum, IsNotEmpty, IsString, IsPhoneNumber, Length, IsOptional } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @IsPhoneNumber('BY')
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role?: UserRole;
}
