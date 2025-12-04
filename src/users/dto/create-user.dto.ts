import { IsEnum, IsNotEmpty, IsString, IsPhoneNumber, Length, Matches } from 'class-validator';
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

  @IsPhoneNumber('RU')
  @Matches(/^\+7-\d{3}-\d{3}-\d{2}-\d{2}$/, {
    message: 'Phone number must be in the format +7-XXX-XXX-XX-XX'
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role?: UserRole;
}