import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { getConfig } from '../config/configuration';

// Внутренние запросы ts → go (5.1). Тайм-аут ~60 с: запрос может разбудить спящий сервис на Render.
@Injectable()
export class GoClientService {
  private readonly logger = new Logger(GoClientService.name);
  private readonly cfg = getConfig().internal;

  private async call(method: string, path: string): Promise<any> {
    let resp: Response;
    try {
      resp = await fetch(this.cfg.mainUrl + path, {
        method,
        headers: { 'X-Internal-Key': this.cfg.apiKey },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      this.logger.error(`go ${method} ${path}: ${e}`);
      throw new ServiceUnavailableException('Сервис активов недоступен, повторите позже');
    }
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error(`go ${method} ${path} -> ${resp.status}: ${text}`);
      throw new ServiceUnavailableException('Сервис активов вернул ошибку, повторите позже');
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : {};
  }

  // Действующие роли «числится за» (списанные не в счёт — их роли закрыты)
  async molAssetsCount(personId: string): Promise<number> {
    const res = await this.call('GET', `/internal/persons/${personId}/assets-count`);
    return Number(res.mol_count ?? 0);
  }

  // Увольнение: закрыть роли «работает с активом»
  async personDismissed(personId: string): Promise<void> {
    await this.call('POST', `/internal/persons/${personId}/dismissed`);
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await this.call('DELETE', `/internal/organizations/${orgId}`);
  }
}
