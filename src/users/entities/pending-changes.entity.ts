import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../../common/enums/request-status.enum';

export type ChangeStatus = RequestStatus;

@Entity('pending_changes')
export class PendingChanges {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Пользователь, который запросил изменение' })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId: string;

  // Отдельные поля для изменений, основанные на User entity
  @ApiPropertyOptional({ description: 'Новое значение login' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  login?: string;

  @ApiPropertyOptional({ description: 'Новое значение password' })
  @Column({ type: 'varchar', nullable: true })
  password?: string;

  @ApiPropertyOptional({ description: 'Новое значение firstName' })
  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Новое значение lastName' })
  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Новое значение middleName' })
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  middleName?: string;

  @ApiPropertyOptional({ description: 'Новое значение phone' })
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone?: string;

  @ApiPropertyOptional({ description: 'Новое значение position' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string;

  @ApiProperty({
    enum: RequestStatus,
    enumName: 'RequestStatus',
    default: RequestStatus.PENDING,
    description: 'Статус запроса на изменение',
    example: RequestStatus.PENDING
  })
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'pending_changes_status_enum',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiPropertyOptional({ type: () => User, description: 'Кто из админов обработал заявку' })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser?: User;

  @ApiPropertyOptional({ description: 'Комментарий администратора (причина отказа или заметка при одобрении)' })
  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment?: string;

  @ApiPropertyOptional({ description: 'Когда была одобрена или отклонена' })
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @ApiProperty({ description: 'Дата и время создания запроса' })
  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @ApiProperty({ description: 'Дата и время последнего обновления запроса' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}