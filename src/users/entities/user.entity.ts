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

  @Column({ type: 'varchar', length: 16, nullable: true })
  @IsString()
  @IsOptional()
  @Matches(/^\+\d{1,15}$/, {
    message: 'Phone must start with + and contain only digits'
  })
  phone?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string;

  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string;

  @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  middleName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsString()
  @IsOptional()
  @Length(3, 100)
  position?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  @IsOptional()
  isActive: boolean;

  @CreateDateColumn()
  @Column({ name: 'created_at'})
  createdAt: Date;

  @UpdateDateColumn()
  @Column({ name: 'updated_at'})
  updatedAt: Date;
}
