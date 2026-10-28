// Служебные таблицы: история владельцев учётных записей, коды на почту,
// журнал, запуски задач и лимиты. Сущности короткие, поэтому собраны в одном файле.
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('account_person_history')
export class AccountPersonHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'from_at', type: 'timestamptz' })
  fromAt: Date;

  @Column({ name: 'to_at', type: 'timestamptz', nullable: true })
  toAt?: Date | null;
}

export enum EmailCodePurpose {
  ORG_REGISTRATION = 'org_registration',
  ADMIN_HANDOVER = 'admin_handover',
  PASSWORD_RESET = 'password_reset',
  EMAIL_CHANGE = 'email_change',
}

@Entity('email_codes')
export class EmailCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 30 })
  purpose: EmailCodePurpose;

  // NULL — письмо без кода (адрес уже занят), запись нужна только для лимитов
  @Column({ name: 'code_hash', type: 'varchar', length: 255, nullable: true })
  codeHash?: string | null;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'actor_type', type: 'varchar', length: 10, default: 'user' })
  actorType: 'user' | 'system';

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId?: string | null;

  @Column({ name: 'actor_person_id', type: 'uuid', nullable: true })
  actorPersonId?: string | null;

  @Column({ length: 50 })
  action: string;

  @Column({ name: 'object_type', type: 'varchar', length: 30, nullable: true })
  objectType?: string | null;

  @Column({ name: 'object_id', type: 'uuid', nullable: true })
  objectId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details?: any;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('job_runs')
export class JobRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  result?: any;
}

@Entity('rate_limit_hits')
export class RateLimitHit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ length: 150 })
  key: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
