import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePendingRegistrationsTable1768565389730 implements MigrationInterface {
    name = 'CreatePendingRegistrationsTable1768565389730'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."pending_registrations_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "pending_registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "login" character varying NOT NULL, "password_hash" character varying NOT NULL, "first_name" character varying(50), "last_name" character varying(50), "middle_name" character varying(50), "phone" character varying(16), "position" character varying(100), "status" "public"."pending_registrations_status_enum" NOT NULL DEFAULT 'PENDING', "approval_comment" text, "rejected_reason" character varying(255), "approved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "approved_by_user_id" uuid, CONSTRAINT "UQ_a063c6cc0af33c24b04913467d8" UNIQUE ("login"), CONSTRAINT "PK_72a24749ddb2c32bd41c3380909" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phone" character varying(16)`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "last_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "last_name" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "first_name" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "middle_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "middle_name" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "position"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "position" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "created_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updated_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "pending_registrations" ADD CONSTRAINT "FK_79749ae92223545d50c3f88c3ca" FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_registrations" DROP CONSTRAINT "FK_79749ae92223545d50c3f88c3ca"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "position"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "position" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "middle_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "middle_name" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "first_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "first_name" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "last_name"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "last_name" character varying`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phone" character varying`);
        await queryRunner.query(`DROP TABLE "pending_registrations"`);
        await queryRunner.query(`DROP TYPE "public"."pending_registrations_status_enum"`);
    }

}
