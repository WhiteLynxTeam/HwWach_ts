// Заявки, которые утверждает админ организации (2.5) и приглашения (9.1)
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { RequestStatus } from '../common/enums/request-status.enum';
import { Person } from './person.entity';
import { Account } from './account.entity';
import { SystemRole } from './system-role.entity';

@Entity('invites')
export class Invite {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ApiHideProperty()
  @Column({ name: 'token_hash', length: 128, select: false })
  tokenHash: string;

  @ApiProperty({ example: 'K7M-42Q' })
  @Column({ name: 'short_code', length: 16 })
  shortCode: string;

  @ApiPropertyOptional({ description: 'Приглашение из карточки человека' })
  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId?: string | null;

  @ManyToOne(() => Person, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'person_id' })
  person?: Person | null;

  @Column({ name: 'system_role_id', type: 'uuid' })
  systemRoleId: string;

  @ManyToOne(() => SystemRole)
  @JoinColumn({ name: 'system_role_id' })
  systemRole?: SystemRole;

  @ApiProperty()
  @Column({ name: 'max_uses', default: 1 })
  maxUses: number;

  @ApiProperty()
  @Column({ name: 'used_count', default: 0 })
  usedCount: number;

  @ApiProperty()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @ApiPropertyOptional()
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'created_by_account_id', type: 'uuid' })
  createdByAccountId: string;

  @Column({ name: 'created_by_person_id', type: 'uuid' })
  createdByPersonId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('pending_registrations')
export class PendingRegistration {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ApiPropertyOptional({ description: 'Человек, заранее заведённый админом' })
  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId?: string | null;

  @Column({ name: 'invite_id', type: 'uuid', nullable: true })
  inviteId?: string | null;

  @ApiProperty({ enum: ['invite', 'search'] })
  @Column({ type: 'varchar', length: 10 })
  source: 'invite' | 'search';

  @Column({ name: 'system_role_id', type: 'uuid', nullable: true })
  systemRoleId?: string | null;

  @ApiProperty({ example: 'user_01' })
  @Column({ length: 255 })
  login: string;

  @ApiHideProperty()
  @Column({ length: 255, select: false })
  password: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone?: string | null;

  @ApiProperty()
  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @ApiProperty()
  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @ApiPropertyOptional()
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  middleName?: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string | null;

  @ApiProperty({ enum: RequestStatus })
  @Column({ type: 'enum', enum: RequestStatus, enumName: 'request_status_enum', default: RequestStatus.PENDING })
  status: RequestStatus;

  @ApiPropertyOptional()
  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment?: string | null;

  @Column({ name: 'processed_by_account_id', type: 'uuid', nullable: true })
  processedByAccountId?: string | null;

  @Column({ name: 'processed_by_person_id', type: 'uuid', nullable: true })
  processedByPersonId?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ name: 'created_ip', type: 'varchar', length: 64, nullable: true, select: false })
  createdIp?: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

// Смена профиля и просьба «я МОЛ» (is_mol = true) — утверждает админ
@Entity('pending_changes')
export class PendingChanges {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ApiProperty()
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ name: 'requested_by_account_id', type: 'uuid' })
  requestedByAccountId: string;

  @ApiPropertyOptional()
  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  firstName?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  lastName?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  middleName?: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone?: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string | null;

  @ApiPropertyOptional({ description: 'true — просьба признать МОЛ' })
  @Column({ name: 'is_mol', type: 'boolean', nullable: true })
  isMol?: boolean | null;

  @ApiProperty({ enum: RequestStatus })
  @Column({ type: 'enum', enum: RequestStatus, enumName: 'request_status_enum', default: RequestStatus.PENDING })
  status: RequestStatus;

  @ApiPropertyOptional()
  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment?: string | null;

  @Column({ name: 'processed_by_account_id', type: 'uuid', nullable: true })
  processedByAccountId?: string | null;

  @Column({ name: 'processed_by_person_id', type: 'uuid', nullable: true })
  processedByPersonId?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('pending_reset_pass')
export class PendingResetPass {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ApiProperty()
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @ApiProperty({ enum: RequestStatus })
  @Column({ type: 'enum', enum: RequestStatus, enumName: 'request_status_enum', default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ name: 'processed_by_account_id', type: 'uuid', nullable: true })
  processedByAccountId?: string | null;

  @Column({ name: 'processed_by_person_id', type: 'uuid', nullable: true })
  processedByPersonId?: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
