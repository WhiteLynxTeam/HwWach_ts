import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsEnum, IsNotEmpty, IsString, IsPhoneNumber, IsOptional, Length, Matches } from 'class-validator';

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  login: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  @Length(6, 100)
  password: string;

  @Column({ unique: true })
  @IsPhoneNumber('RU')
  @Matches(/^\+7-\d{3}-\d{3}-\d{2}-\d{2}$/, {
    message: 'Phone number must be in the format +7-XXX-XXX-XX-XX'
  })
  phone: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  fullName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @Column({ default: true })
  @IsOptional()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}