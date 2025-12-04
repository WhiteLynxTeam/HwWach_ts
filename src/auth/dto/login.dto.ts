import { IsString, IsNotEmpty, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;
}