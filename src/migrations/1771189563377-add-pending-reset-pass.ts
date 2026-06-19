import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingResetPass1771189563377 implements MigrationInterface {
    name = 'AddPendingResetPass1771189563377'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "pending_reset_pass" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING',
                "processed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "approved_by_user_id" uuid,
                CONSTRAINT "PK_pending_reset_pass" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "IDX_pending_reset_pass_user_id" ON "pending_reset_pass" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_pending_reset_pass_status" ON "pending_reset_pass" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_pending_reset_pass_created_at" ON "pending_reset_pass" ("created_at")`);

        await queryRunner.query(`
            ALTER TABLE "pending_reset_pass" 
            ADD CONSTRAINT "FK_pending_reset_pass_user_id" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "pending_reset_pass" 
            ADD CONSTRAINT "FK_pending_reset_pass_approved_by_user_id" 
            FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_reset_pass" DROP CONSTRAINT "FK_pending_reset_pass_approved_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "pending_reset_pass" DROP CONSTRAINT "FK_pending_reset_pass_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pending_reset_pass_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pending_reset_pass_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pending_reset_pass_user_id"`);
        await queryRunner.query(`DROP TABLE "pending_reset_pass"`);
    }
}
