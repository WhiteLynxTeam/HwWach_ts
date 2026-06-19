import { Entity, Column, Index, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../../common/enums/request-status.enum';

@Entity('pending_reset_pass')
export class PendingResetPass {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Пользователь, который запросил сброс пароля' })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @ApiProperty({
    enum: RequestStatus,
    enumName: 'RequestStatus',
    default: RequestStatus.PENDING,
    description: 'Статус запроса на сброс пароля',
    example: RequestStatus.PENDING
  })
  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiPropertyOptional({ type: () => User, description: 'Кто из админов обработал заявку' })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser?: User;

  @ApiPropertyOptional({ description: 'Когда была одобрена или отклонена' })
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Index()
  @ApiProperty({ 
    description: 'Дата и время создания запроса', 
    example: '2023-10-27T10:00:00.000Z',
    readOnly: true
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ 
    description: 'Дата и время последнего обновления запроса', 
    example: '2023-10-27T10:00:00.000Z',
    readOnly: true
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
