import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsString, IsPhoneNumber, IsOptional, Length, Matches } from 'class-validator';
import { User } from './user.entity';

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('pending_registrations')
export class PendingRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @Column({ name: 'password_hash' })
  @IsString()
  @IsNotEmpty()
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @Column({ type: 'varchar', length: 16, nullable: true }) // Соответствует длине в User entity
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,15}$/, {
    message: 'Phone must start with + and contain only digits'
  })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.PENDING
  })
  status: RegistrationStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser?: User;

  @Column({ name: 'approval_comment', type: 'text', nullable: true })
  approvalComment?: string;

  @Column({ name: 'rejected_reason', type: 'varchar', length: 255, nullable: true })
  rejectedReason?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}