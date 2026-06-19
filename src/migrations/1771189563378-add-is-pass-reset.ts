import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPassReset1771189563378 implements MigrationInterface {
    name = 'AddIsPassReset1771189563378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD "is_pass_reset" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN "is_pass_reset"
        `);
    }
}
