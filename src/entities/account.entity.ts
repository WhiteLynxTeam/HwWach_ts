import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { Person } from './person.entity';
import { Organization } from './organization.entity';
import { SystemRole } from './system-role.entity';

// Учётная запись несёт системную роль (2.3). Заменяет прежнюю users.
// login / email / person_id уникальны только среди активных записей.
@Entity('accounts')
export class Account {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'ivanov_77' })
  @Column({ length: 255 })
  login: string;

  @ApiHideProperty()
  @Column({ length: 255, select: false })
  password: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ name: 'system_role_id', type: 'uuid' })
  systemRoleId: string;

  @ManyToOne(() => SystemRole)
  @JoinColumn({ name: 'system_role_id' })
  systemRole?: SystemRole;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ default: false, description: 'Флаг сброшенного/временного пароля' })
  @Column({ name: 'is_pass_reset', default: false })
  isPassReset: boolean;

  @ApiPropertyOptional({ description: 'Срок доступа (наблюдатель, временные роли)' })
  @Column({ name: 'access_expires_at', type: 'timestamptz', nullable: true })
  accessExpiresAt?: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  // +1 при смене роли, блокировке, увольнении, смене пароля, передаче админства — старые refresh отзываются
  @ApiHideProperty()
  @Column({ name: 'token_version', default: 0 })
  tokenVersion: number;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
