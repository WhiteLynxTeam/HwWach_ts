import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1769085806035 implements MigrationInterface {
    name = 'InitSchema1769085806035'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "login" character varying NOT NULL, "password" character varying NOT NULL, "phone" character varying(16), "last_name" character varying(50), "first_name" character varying(50), "middle_name" character varying(50), "position" character varying(100), "role" "public"."user_role_enum" NOT NULL DEFAULT 'USER', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a62473490b3e4578fd683235c5e" UNIQUE ("login"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."pending_registration_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "pending_registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "login" character varying NOT NULL, "password_hash" character varying NOT NULL, "first_name" character varying(50), "last_name" character varying(50), "middle_name" character varying(50), "phone" character varying(16), "position" character varying(100), "status" "public"."pending_registration_status_enum" NOT NULL DEFAULT 'PENDING', "approval_comment" text, "rejected_reason" character varying(255), "approved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "approved_by_user_id" uuid, CONSTRAINT "UQ_a063c6cc0af33c24b04913467d8" UNIQUE ("login"), CONSTRAINT "PK_72a24749ddb2c32bd41c3380909" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "pending_registrations" ADD CONSTRAINT "FK_79749ae92223545d50c3f88c3ca" FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_registrations" DROP CONSTRAINT "FK_79749ae92223545d50c3f88c3ca"`);
        await queryRunner.query(`DROP TABLE "pending_registrations"`);
        await queryRunner.query(`DROP TYPE "public"."pending_registration_status_enum"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
