import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { IsEnum, IsOptional, IsString, IsPhoneNumber, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('pending_changes')
export class PendingChanges {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Пользователь, который запросил изменение' })
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User;

  @Column({ name: 'requested_by_user_id' })
  requestedByUserId: string;

  // Отдельные поля для изменений, основанные на User entity
  @ApiProperty({ description: 'Новое значение login', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(3, 50)
  login?: string;

  @ApiProperty({ description: 'Новое значение password', required: false })
  @Column({ type: 'varchar', nullable: true })
  @IsString()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @ApiProperty({ description: 'Новое значение firstName', required: false })
  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @ApiProperty({ description: 'Новое значение lastName', required: false })
  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @ApiProperty({ description: 'Новое значение middleName', required: false })
  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @ApiProperty({ description: 'Новое значение phone', required: false })
  @Column({ type: 'varchar', length: 16, nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,15}$/, {
    message: 'Phone must start with + and contain only digits'
  })
  phone?: string;

  @ApiProperty({ description: 'Новое значение position', required: false })
  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;

  @ApiProperty({
    enum: ChangeStatus,
    description: 'Статус запроса на изменение',
    default: ChangeStatus.PENDING
  })
  @Column({
    type: 'enum',
    enum: ChangeStatus,
    default: ChangeStatus.PENDING,
  })
  @IsEnum(ChangeStatus)
  status: ChangeStatus;

  @ApiProperty({ description: 'ID пользователя, который одобрил запрос (если применимо)', required: false })
  @Column({ name: 'approved_by_user_id', nullable: true })
  @IsOptional()
  approvedById?: string;

  @ApiProperty({ description: 'Пользователь, который одобрил запрос (если применимо)', required: false })
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedBy?: User;

  @ApiProperty({ description: 'Комментарий к одобрению запроса', required: false })
  @Column({ name: 'approval_comment', nullable: true })
  @IsString()
  @IsOptional()
  approvalComment?: string;

  @ApiProperty({ description: 'Причина отказа в запросе', required: false })
  @Column({ name: 'rejected_reason', nullable: true })
  @IsString()
  @IsOptional()
  rejectedReason?: string;

  @ApiProperty({ description: 'Дата и время создания запроса' })
  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @ApiProperty({ description: 'Дата и время последнего обновления запроса' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}