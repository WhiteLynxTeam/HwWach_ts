import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';

// Активность и «наполненность» организации — для автоудаления (8.6)
@Injectable()
export class OrgActivityService {
  constructor(@InjectRepository(Organization) private orgs: Repository<Organization>) {}

  // Любой вход или изменение сбрасывает таймер удаления. Пишем не чаще раза в час.
  async touch(orgId: string): Promise<void> {
    await this.orgs
      .createQueryBuilder()
      .update()
      .set({ lastActivityAt: () => 'now()', deletionScheduledAt: null, deletionWarnedStage: null })
      .where('id = :id AND deleted_at IS NULL', { id: orgId })
      .andWhere(`(last_activity_at < now() - interval '1 hour' OR deletion_scheduled_at IS NOT NULL)`)
      .execute();
  }

  async markFilled(orgId: string): Promise<void> {
    await this.orgs.update({ id: orgId, isFilled: false }, { isFilled: true });
  }
}
