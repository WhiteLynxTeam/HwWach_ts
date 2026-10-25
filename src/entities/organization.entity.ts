import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrganizationStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

@Entity('organizations')
export class Organization {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'ОАО «Беловежская пуща»' })
  @Column({ length: 255 })
  name: string;

  @ApiPropertyOptional()
  @Column({ name: 'short_name', type: 'varchar', length: 100, nullable: true })
  shortName?: string | null;

  // название и короткое название в нижнем регистре, ё → е: поиск не зависит от локали БД
  @Column({ name: 'search_name', length: 400, default: '', select: false })
  searchName: string;

  @ApiProperty({ enum: OrganizationStatus })
  @Column({ type: 'varchar', length: 20, default: OrganizationStatus.ACTIVE })
  status: OrganizationStatus;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 500, nullable: true })
  address?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'director_name', type: 'varchar', length: 150, nullable: true })
  directorName?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'owner_name', type: 'varchar', length: 150, nullable: true })
  ownerName?: string | null;

  @Column({ name: 'created_ip', type: 'varchar', length: 64, nullable: true, select: false })
  createdIp?: string | null;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt: Date;

  @Column({ name: 'is_filled', default: false })
  isFilled: boolean;

  @Column({ name: 'deletion_scheduled_at', type: 'timestamptz', nullable: true })
  deletionScheduledAt?: Date | null;

  @Column({ name: 'deletion_warned_stage', type: 'smallint', nullable: true })
  deletionWarnedStage?: number | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @Column({ name: 'go_cleanup_pending', default: false })
  goCleanupPending: boolean;

  @Column({ name: 'created_by_account_id', type: 'uuid', nullable: true })
  createdByAccountId?: string | null;

  @Column({ name: 'created_by_person_id', type: 'uuid', nullable: true })
  createdByPersonId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export function normalizeSearch(s: string): string {
  return (s ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function orgSearchName(name: string, shortName?: string | null): string {
  return normalizeSearch([name, shortName].filter(Boolean).join(' '));
}
