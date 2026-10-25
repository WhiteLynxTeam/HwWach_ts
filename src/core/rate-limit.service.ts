import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { RateLimitHit } from '../entities/misc.entity';

// Лимиты — в БД, не в памяти: после засыпания Render память пустая (8.7)
@Injectable()
export class RateLimitService {
  constructor(@InjectRepository(RateLimitHit) private repo: Repository<RateLimitHit>) {}

  // Считает обращение и бросает 429, если за окно их уже limit
  async hit(key: string, limit: number, windowMs: number, message: string): Promise<void> {
    const since = new Date(Date.now() - windowMs);
    const count = await this.repo.count({ where: { key, createdAt: MoreThan(since) } });
    if (count >= limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.repo.insert({ key });
  }

  async cleanup(olderThan: Date): Promise<number> {
    const res = await this.repo.delete({ createdAt: LessThan(olderThan) });
    return res.affected ?? 0;
  }
}
