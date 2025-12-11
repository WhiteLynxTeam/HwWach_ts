import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserTable1733274432000 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'user',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'uuid',
        },
        {
          name: 'login',
          type: 'varchar',
          isUnique: true,
          isNullable: false,
        },
        {
          name: 'password',
          type: 'varchar',
          isNullable: false,
        },
        {
          name: 'phone',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'last_name',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'first_name',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'middle_name',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'position',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'role',
          type: 'enum',
          enum: ['ADMIN', 'USER'],
          default: "'USER'",
        },
        {
          name: 'is_active',
          type: 'boolean',
          default: true,
        },
        {
          name: 'created_at',
          type: 'timestamp',
          default: 'now()',
        },
        {
          name: 'updated_at',
          type: 'timestamp',
          default: 'now()',
          onUpdate: 'now()',
        },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user');
  }

}
