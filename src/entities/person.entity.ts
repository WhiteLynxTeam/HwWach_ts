import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Organization } from './organization.entity';

// Человек: ФИО и должность. Может быть без учётной записи (2.2)
@Entity('persons')
export class Person {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @ApiProperty({ example: 'Иванов' })
  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @ApiProperty({ example: 'Иван' })
  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @ApiPropertyOptional({ example: 'Иванович' })
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  middleName?: string | null;

  @ApiPropertyOptional({ example: 'Инженер' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string | null;

  @ApiPropertyOptional({ example: '+375291234567' })
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone?: string | null;

  @ApiProperty({ description: 'Материально ответственное лицо — ставит админ' })
  @Column({ name: 'is_mol', default: false })
  isMol: boolean;

  @ApiPropertyOptional({ description: 'Человек сам попросил признак МОЛ, ждёт админа' })
  @Column({ name: 'mol_requested_at', type: 'timestamptz', nullable: true })
  molRequestedAt?: Date | null;

  @ApiProperty({ description: 'false — уволен' })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'dismissed_at', type: 'timestamptz', nullable: true })
  dismissedAt?: Date | null;

  @Column({ name: 'created_by_account_id', type: 'uuid', nullable: true })
  createdByAccountId?: string | null;

  @Column({ name: 'created_by_person_id', type: 'uuid', nullable: true })
  createdByPersonId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export function personFullName(p: Pick<Person, 'lastName' | 'firstName' | 'middleName'>): string {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}
