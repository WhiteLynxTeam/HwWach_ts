import { Entity, Column, PrimaryColumn, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('permissions')
export class Permission {
  @ApiProperty({ example: 'assets.manage' })
  @PrimaryColumn({ length: 50 })
  code: string;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  description?: string | null;
}

// uuid встроенных ролей фиксированы миграцией (common/permissions.ts)
@Entity('system_roles')
export class SystemRole {
  @ApiProperty()
  @PrimaryColumn('uuid')
  id: string;

  @ApiProperty({ example: 'admin' })
  @Column({ length: 50, unique: true })
  code: string;

  @ApiProperty({ example: 'Администратор' })
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'is_builtin', default: true })
  isBuiltin: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'system_role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_code', referencedColumnName: 'code' },
  })
  permissions?: Permission[];
}
