import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('users')
export class User {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'ivanov_77' })
  @Column({ length: 50, unique: true })
  login: string;

  @ApiHideProperty()
  @Column({ 
    length: 255, 
    select: false // Защита: пароль не вывалится в JSON просто так
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

  @ApiPropertyOptional({ example: 'Инженер' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.USER
  })
  role: UserRole;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty({ default: false, description: 'Флаг сброшенного/временного пароля' })
  @Column({ name: 'is_pass_reset', default: false })
  isPassReset: boolean;

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
