import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { RequestStatus } from '../../common/enums/request-status.enum';

export type RegistrationStatus = RequestStatus;

@Entity('pending_registrations')
export class PendingRegistration {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Почему поле логина не уникальное? Потому что мы не удаляем отклоненные заявки на регистрацию,
  // а храним их для истории. И пользователь не сможет зарегистрировать свой логин повторно,
  // если заявка была отклонена администратором
  @Index()
  @ApiProperty({ example: 'user_01' })
  @Column({ length: 50 })
  login: string;

  @ApiHideProperty()
  @Column({ 
    length: 255, 
    select: false
  })
  password: string;

  @ApiPropertyOptional({ example: '+375291234567' })
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone?: string;

  @ApiPropertyOptional({ example: 'Иванов' })
  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  lastName?: string;

  @ApiPropertyOptional({ example: 'Иван' })
  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванович' })
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  middleName?: string;

  @ApiPropertyOptional({ example: 'Инженер-механик' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string;

  @Index()
  @ApiProperty({
  enum: RequestStatus,
  enumName: 'RequestStatus',
  default: RequestStatus.PENDING,
  description: 'Статус заявки на регистрацию',
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

  @ApiPropertyOptional({ description: 'Комментарий администратора (причина отказа или заметка при одобрении)' })
  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment?: string;

  @ApiPropertyOptional({ description: 'Когда была одобрена или отклонена' })
  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Index()
  @ApiProperty({ 
    description: 'Дата и время создания записи', 
    example: '2023-10-27T10:00:00.000Z',
    readOnly: true
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ 
    description: 'Дата и время последнего обновления записи', 
    example: '2023-10-27T12:00:00.000Z',
    readOnly: true 
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}