import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveResetPasswordDto {
  @ApiPropertyOptional({ example: 'newPassword123', description: 'Новый пароль (если не передан или пустой, то будет установлен пароль по умолчанию)' })
  @IsOptional()
  @IsString()
  password?: string;
}
