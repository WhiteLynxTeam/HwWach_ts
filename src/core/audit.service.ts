import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { AuditLog } from '../entities/misc.entity';
import { AuthUser } from '../common/auth-user';

export interface AuditEntry {
  org: string;
  // нет user — действие системы (ежесуточная задача, автоудаление)
  user?: AuthUser | null;
  action: string;
  objectType?: string;
  objectId?: string | null;
  details?: Record<string, unknown>;
  ip?: string;
}

// Журнал ts: люди, учётные записи, регистрации, организации (3.4).
// Человек берётся из токена в момент действия, а не из учётной записи.
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async log(e: AuditEntry, manager?: EntityManager): Promise<void> {
    const row = {
      organizationId: e.org,
      actorType: e.user ? 'user' : 'system',
      accountId: e.user?.id ?? null,
      actorPersonId: e.user?.person ?? null,
      action: e.action,
      objectType: e.objectType ?? null,
      objectId: e.objectId ?? null,
      details: e.details ?? null,
      ip: e.ip ?? null,
    } as AuditLog;
    if (manager) {
      await manager.insert(AuditLog, row);
    } else {
      await this.repo.insert(row);
    }
  }

  async list(org: string, opts: { limit?: number; before?: Date; objectId?: string }): Promise<AuditLog[]> {
    const where: any = { organizationId: org };
    if (opts.before) where.createdAt = LessThan(opts.before);
    if (opts.objectId) where.objectId = opts.objectId;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: Math.min(opts.limit ?? 100, 500) });
  }
}
