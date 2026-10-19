import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// Публичная проверка доступности. Клиенты дёргают её при старте,
// чтобы «разбудить» сервис на Render до первого входа пользователя
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check (public)' })
  check(): { status: string } {
    return { status: 'ok' };
  }
}
