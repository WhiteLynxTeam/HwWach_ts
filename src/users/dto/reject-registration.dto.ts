import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../decorators/trim.decorator';

export class RejectRegistrationDto {
  @ApiProperty({ example: 'Не указана должность', description: 'Причина отклонения заявки (обязательно)' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Причина отклонения обязательна' })
  @MaxLength(500)
  reason: string;
}
