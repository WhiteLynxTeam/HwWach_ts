import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePendingChangesTable1769771856629 implements MigrationInterface {
    name = 'CreatePendingChangesTable1769771856629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."pending_changes_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "pending_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requested_by_user_id" uuid NOT NULL, "login" character varying(50), "password" character varying, "first_name" character varying(50), "last_name" character varying(50), "middle_name" character varying(50), "phone" character varying(16), "position" character varying(100), "status" "public"."pending_changes_status_enum" NOT NULL DEFAULT 'PENDING', "approved_by_user_id" uuid, "approval_comment" character varying, "rejected_reason" character varying, "requested_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b078bce01c9e43dc324138e26a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum" USING "role"::"text"::"public"."user_role_enum"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "pending_changes" ADD CONSTRAINT "FK_b682ad808c2ea62d7a53a6c689a" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_changes" ADD CONSTRAINT "FK_79c6f23c2e48de85443278c8aca" FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_changes" DROP CONSTRAINT "FK_79c6f23c2e48de85443278c8aca"`);
        await queryRunner.query(`ALTER TABLE "pending_changes" DROP CONSTRAINT "FK_b682ad808c2ea62d7a53a6c689a"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum_old" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::"text"::"public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`);
        await queryRunner.query(`DROP TABLE "pending_changes"`);
        await queryRunner.query(`DROP TYPE "public"."pending_changes_status_enum"`);
    }

}
