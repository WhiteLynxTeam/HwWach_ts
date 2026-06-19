import { IsBoolean, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Пароль (4-100 символов, либо пустая строка для сброса по умолчанию)',
    example: 'strongPassword123!',
    required: false
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.password !== '')
  @Length(4, 100)
  password?: string;

  @ApiProperty({
    description: 'Статус активности пользователя',
    example: true,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
