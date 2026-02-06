import { IsOptional, IsString, IsPhoneNumber, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestUserChangeDto {
  @ApiProperty({ description: 'Новое значение login', required: false })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  login?: string;

  @ApiProperty({ description: 'Новое значение password', required: false })
  @IsString()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @ApiProperty({ description: 'Новое значение firstName', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @ApiProperty({ description: 'Новое значение lastName', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @ApiProperty({ description: 'Новое значение middleName', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @ApiProperty({ description: 'Новое значение phone', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,15}$/, {
    message: 'Phone must start with + and contain only digits'
  })
  phone?: string;

  @ApiProperty({ description: 'Новое значение position', required: false })
  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;
}