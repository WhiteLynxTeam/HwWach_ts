import { MigrationInterface, QueryRunner } from "typeorm";

export class FreshDbMigration1771189563376 implements MigrationInterface {
    name = 'FreshDbMigration1771189563376'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "login" character varying(50) NOT NULL, "password" character varying(255) NOT NULL, "phone" character varying(16), "last_name" character varying(50), "first_name" character varying(50), "middle_name" character varying(50), "position" character varying(100), "role" "public"."user_role_enum" NOT NULL DEFAULT 'USER', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2d443082eccd5198f95f2a36e2c" UNIQUE ("login"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "pending_registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "login" character varying(50) NOT NULL, "password" character varying(255) NOT NULL, "phone" character varying(16), "last_name" character varying(50), "first_name" character varying(50), "middle_name" character varying(50), "position" character varying(100), "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING', "admin_comment" text, "processed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "approved_by_user_id" uuid, CONSTRAINT "PK_72a24749ddb2c32bd41c3380909" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a063c6cc0af33c24b04913467d" ON "pending_registrations" ("login") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc292ef17a95a6bbaadb1296d5" ON "pending_registrations" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_25061f6c2e6a5b4fc69830c922" ON "pending_registrations" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "pending_changes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requested_by_user_id" uuid NOT NULL, "first_name" character varying(50), "last_name" character varying(50), "middle_name" character varying(50), "phone" character varying(16), "position" character varying(100), "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING', "admin_comment" text, "processed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "approved_by_user_id" uuid, CONSTRAINT "CHK_9718c853a526b50d9d696c8989" CHECK (
  "first_name" IS NOT NULL OR
  "last_name" IS NOT NULL OR
  "middle_name" IS NOT NULL OR
  "phone" IS NOT NULL OR
  "position" IS NOT NULL
), CONSTRAINT "PK_b078bce01c9e43dc324138e26a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b682ad808c2ea62d7a53a6c689" ON "pending_changes" ("requested_by_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_617abafefc8bb099002ba9d03e" ON "pending_changes" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_da6d14776c9606a4ff316f32f9" ON "pending_changes" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "pending_registrations" ADD CONSTRAINT "FK_79749ae92223545d50c3f88c3ca" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_changes" ADD CONSTRAINT "FK_b682ad808c2ea62d7a53a6c689a" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_changes" ADD CONSTRAINT "FK_79c6f23c2e48de85443278c8aca" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_changes" DROP CONSTRAINT "FK_79c6f23c2e48de85443278c8aca"`);
        await queryRunner.query(`ALTER TABLE "pending_changes" DROP CONSTRAINT "FK_b682ad808c2ea62d7a53a6c689a"`);
        await queryRunner.query(`ALTER TABLE "pending_registrations" DROP CONSTRAINT "FK_79749ae92223545d50c3f88c3ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da6d14776c9606a4ff316f32f9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_617abafefc8bb099002ba9d03e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b682ad808c2ea62d7a53a6c689"`);
        await queryRunner.query(`DROP TABLE "pending_changes"`);
        await queryRunner.query(`DROP TYPE "public"."request_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25061f6c2e6a5b4fc69830c922"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc292ef17a95a6bbaadb1296d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a063c6cc0af33c24b04913467d"`);
        await queryRunner.query(`DROP TABLE "pending_registrations"`);
        await queryRunner.query(`DROP TYPE "public"."request_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
