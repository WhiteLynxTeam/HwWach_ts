import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Not, Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { AuditLog, JobRun } from '../entities/misc.entity';
import { AuditService } from '../core/audit.service';
import { EmailCodesService } from '../core/email-codes.service';
import { GoClientService } from '../core/go-client.service';
import { RateLimitService } from '../core/rate-limit.service';
import { MailSender, GmailRevokedError } from '../mail/mail.service';
import { MailTemplates } from '../mail/mail.templates';
import { AccountsService } from '../users/accounts.service';
import { RegistrationsService } from '../users/registrations.service';
import { getConfig } from '../config/configuration';

const DAY = 86_400_000;
const WARN_STAGES = [30, 7, 3];

// Ежесуточная задача (8.6, 8.7). Запускается внешним будильником — POST /internal/jobs/daily:
// спящий сервис на Render таймеры внутри процесса не выполняет.
// Идемпотентна: повторный запуск ничего не ломает, пропущенные сутки догоняются (выбор по датам)
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(JobRun) private runs: Repository<JobRun>,
    private accounts: AccountsService,
    private regs: RegistrationsService,
    private audit: AuditService,
    private codes: EmailCodesService,
    private limits: RateLimitService,
    private go: GoClientService,
    private mail: MailSender,
    private dataSource: DataSource,
  ) {}

  async daily(): Promise<Record<string, unknown>> {
    const run = await this.runs.save(this.runs.create({ name: 'daily', startedAt: new Date() }));
    const result: Record<string, unknown> = {};
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try {
        result[name] = await fn();
      } catch (e) {
        this.logger.error(`daily/${name}: ${e}`);
        result[name] = { error: String(e instanceof Error ? e.message : e) };
      }
    };

    await step('gmail', async () => {
      try {
        await this.mail.keepAlive();
        return 'ok';
      } catch (e) {
        if (e instanceof GmailRevokedError) return { error: e.message };
        throw e;
      }
    });
    await step('expiredRegistrations', () => this.regs.expireOld(getConfig().retention.registrationExpireDays));
    await step('emptyOrgs', () => this.softDeleteEmpty());
    await step('inactiveOrgs', () => this.warnAndDeleteInactive());
    await step('purged', () => this.purge());
    await step('cleanup', async () => ({
      rateLimitHits: await this.limits.cleanup(new Date(Date.now() - DAY)),
      emailCodes: await this.codes.cleanup(new Date(Date.now() - 7 * DAY)),
    }));

    await this.runs.update(run.id, { finishedAt: new Date(), result: result as any });
    return { runId: run.id, ...result };
  }

  async lastRun(): Promise<JobRun | null> {
    return this.runs.findOne({ where: { name: 'daily' }, order: { startedAt: 'DESC' } });
  }

  // Пустая организация удаляется через 14 дней без писем — терять нечего
  private async softDeleteEmpty(): Promise<number> {
    const days = getConfig().retention.emptyOrgDays;
    const list = await this.orgs.find({ where: { isFilled: false, deletedAt: IsNull(), createdAt: LessThan(new Date(Date.now() - days * DAY)) } });
    for (const o of list) {
      await this.orgs.update(o.id, { deletedAt: new Date() });
      await this.audit.log({ org: o.id, action: 'org.soft_deleted', objectType: 'organization', objectId: o.id, details: { reason: 'empty', name: o.name } });
    }
    return list.length;
  }

  // Наполненная без движения 12 месяцев: письма за 30 / 7 / 3 дня, потом мягкое удаление
  private async warnAndDeleteInactive(): Promise<{ warned: number; deleted: number }> {
    const { inactiveOrgDays } = getConfig().retention;
    const warnFrom = new Date(Date.now() - (inactiveOrgDays - WARN_STAGES[0]) * DAY);
    const list = await this.orgs.find({ where: { isFilled: true, deletedAt: IsNull(), lastActivityAt: LessThan(warnFrom) } });
    let warned = 0;
    let deleted = 0;
    for (const o of list) {
      const scheduled = o.deletionScheduledAt ?? new Date(o.lastActivityAt.getTime() + inactiveOrgDays * DAY);
      const daysLeft = Math.ceil((scheduled.getTime() - Date.now()) / DAY);
      if (daysLeft <= 0) {
        await this.orgs.update(o.id, { deletedAt: new Date() });
        await this.audit.log({ org: o.id, action: 'org.soft_deleted', objectType: 'organization', objectId: o.id, details: { reason: 'inactive', name: o.name } });
        deleted++;
        continue;
      }
      // самое срочное письмо, которое ещё не уходило
      const stage = [...WARN_STAGES].reverse().find((s) => daysLeft <= s);
      if (stage === undefined || (o.deletionWarnedStage != null && o.deletionWarnedStage <= stage)) {
        if (!o.deletionScheduledAt) await this.orgs.update(o.id, { deletionScheduledAt: scheduled });
        continue;
      }
      const recipients = await this.accounts.orgRecipients(o);
      for (const to of recipients) {
        await this.mail.send(MailTemplates.deletionWarning(to, o.name, daysLeft, scheduled)).catch((e) => this.logger.error(`warn ${to}: ${e}`));
      }
      await this.orgs.update(o.id, { deletionScheduledAt: scheduled, deletionWarnedStage: stage });
      await this.audit.log({ org: o.id, action: 'org.deletion_warned', objectType: 'organization', objectId: o.id, details: { daysLeft, stage, recipients: recipients.length } });
      warned++;
    }
    return { warned, deleted };
  }

  // Через 30 дней после мягкого удаления — окончательно: сначала данные и фото в go, потом строки ts
  private async purge(): Promise<{ purged: number; pendingGo: number }> {
    const days = getConfig().retention.softDeleteDays;
    const list = await this.orgs.find({ where: { deletedAt: Not(IsNull()) } });
    let purged = 0;
    let pendingGo = 0;
    for (const o of list) {
      if (!o.deletedAt || o.deletedAt.getTime() > Date.now() - days * DAY) continue;
      try {
        await this.go.deleteOrganization(o.id);
      } catch {
        await this.orgs.update(o.id, { goCleanupPending: true });
        pendingGo++;
        continue;
      }
      await this.dataSource.transaction(async (m) => {
        await m.delete(AuditLog, { organizationId: o.id });
        await m.delete(Organization, { id: o.id });
        // от организации остаётся одна строка журнала — без людей
        await this.audit.log({ org: o.id, action: 'org.purged', objectType: 'organization', objectId: o.id, details: { name: o.name, deletedAt: o.deletedAt } }, m);
      });
      purged++;
    }
    return { purged, pendingGo };
  }
}
