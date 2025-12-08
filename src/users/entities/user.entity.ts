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
  @Matches(/^\+\d{1,15}$/, {
    message: 'Phone must start with + and contain only digits'
  })
  phone: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  lastName: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName: string | null;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  @Length(3, 100)
  position: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER
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