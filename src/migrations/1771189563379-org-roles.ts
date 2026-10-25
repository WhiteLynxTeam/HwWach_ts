import { MigrationInterface, QueryRunner } from 'typeorm';
import { ADMIN_ROLE_ID, BUILTIN_ROLES, PERMISSION_DESCRIPTIONS, ROLE_PERMISSIONS } from '../common/permissions';

// Организации, люди, учётные записи, роли и права (org-roles-plan.md).
// Рабочих данных ещё нет, поэтому старые users / pending_* удаляются,
// а схема создаётся заново, без переноса.
export class OrgRoles1771189563379 implements MigrationInterface {
  name = 'OrgRoles1771189563379';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "pending_reset_pass" CASCADE`);
    await q.query(`DROP TABLE IF EXISTS "pending_changes" CASCADE`);
    await q.query(`DROP TABLE IF EXISTS "pending_registrations" CASCADE`);
    await q.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await q.query(`DROP TYPE IF EXISTS "public"."user_role_enum"`);
    await q.query(`DROP TYPE IF EXISTS "public"."request_status_enum"`);

    await q.query(`CREATE TYPE "public"."request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')`);

    await q.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "short_name" varchar(100),
        "search_name" varchar(400) NOT NULL DEFAULT '',
        "status" varchar(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'blocked')),
        "email" varchar(255),
        "email_verified_at" timestamptz,
        "address" varchar(500),
        "director_name" varchar(150),
        "owner_name" varchar(150),
        "created_ip" varchar(64),
        "last_activity_at" timestamptz NOT NULL DEFAULT now(),
        "is_filled" boolean NOT NULL DEFAULT false,
        "deletion_scheduled_at" timestamptz,
        "deletion_warned_stage" smallint,
        "deleted_at" timestamptz,
        "go_cleanup_pending" boolean NOT NULL DEFAULT false,
        "created_by_account_id" uuid,
        "created_by_person_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_organizations_email" ON "organizations" (lower("email")) WHERE "deleted_at" IS NULL AND "email" IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_organizations_created_ip" ON "organizations" ("created_ip", "created_at")`);

    await q.query(`
      CREATE TABLE "persons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "last_name" varchar(50) NOT NULL,
        "first_name" varchar(50) NOT NULL,
        "middle_name" varchar(50),
        "position" varchar(100),
        "phone" varchar(16),
        "is_mol" boolean NOT NULL DEFAULT false,
        "mol_requested_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "dismissed_at" timestamptz,
        "created_by_account_id" uuid,
        "created_by_person_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_persons" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_persons_org_name" ON "persons" ("organization_id", "last_name", "first_name")`);

    await q.query(`
      CREATE TABLE "system_roles" (
        "id" uuid NOT NULL,
        "code" varchar(50) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "is_builtin" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_system_roles" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "permissions" (
        "code" varchar(50) NOT NULL,
        "description" text,
        CONSTRAINT "PK_permissions" PRIMARY KEY ("code")
      )`);
    await q.query(`
      CREATE TABLE "system_role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "system_roles"("id") ON DELETE CASCADE,
        "permission_code" varchar(50) NOT NULL REFERENCES "permissions"("code") ON DELETE CASCADE,
        CONSTRAINT "PK_system_role_permissions" PRIMARY KEY ("role_id", "permission_code")
      )`);

    await q.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "login" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "system_role_id" uuid NOT NULL REFERENCES "system_roles"("id"),
        "is_active" boolean NOT NULL DEFAULT true,
        "is_pass_reset" boolean NOT NULL DEFAULT false,
        "access_expires_at" timestamptz,
        "last_login_at" timestamptz,
        "token_version" int NOT NULL DEFAULT 0,
        "email" varchar(255),
        "email_verified_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
      )`);
    // Уникальность только среди активных: отключённые записи остаются для истории (2.3)
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_login_active" ON "accounts" (lower("login")) WHERE "is_active"`);
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_person_active" ON "accounts" ("person_id") WHERE "is_active"`);
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_email_active" ON "accounts" (lower("email")) WHERE "is_active" AND "email" IS NOT NULL`);
    // Один админ на организацию — литерал uuid роли admin (предикат не может смотреть в system_roles)
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_one_admin" ON "accounts" ("organization_id") WHERE "system_role_id" = '${ADMIN_ROLE_ID}' AND "is_active"`);
    await q.query(`CREATE INDEX "IDX_accounts_org" ON "accounts" ("organization_id")`);

    await q.query(`
      CREATE TABLE "account_person_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "person_id" uuid NOT NULL,
        "from_at" timestamptz NOT NULL DEFAULT now(),
        "to_at" timestamptz,
        CONSTRAINT "PK_account_person_history" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_account_person_history_account" ON "account_person_history" ("account_id", "from_at")`);

    await q.query(`
      CREATE TABLE "invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "token_hash" varchar(128) NOT NULL UNIQUE,
        "short_code" varchar(16) NOT NULL UNIQUE,
        "person_id" uuid REFERENCES "persons"("id") ON DELETE SET NULL,
        "system_role_id" uuid NOT NULL REFERENCES "system_roles"("id"),
        "max_uses" int NOT NULL DEFAULT 1,
        "used_count" int NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_by_account_id" uuid NOT NULL,
        "created_by_person_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invites" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_invites_org" ON "invites" ("organization_id", "created_at")`);

    await q.query(`
      CREATE TABLE "pending_registrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "person_id" uuid REFERENCES "persons"("id") ON DELETE SET NULL,
        "invite_id" uuid REFERENCES "invites"("id") ON DELETE SET NULL,
        "source" varchar(10) NOT NULL CHECK ("source" IN ('invite', 'search')),
        "system_role_id" uuid REFERENCES "system_roles"("id"),
        "login" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "phone" varchar(16),
        "last_name" varchar(50) NOT NULL,
        "first_name" varchar(50) NOT NULL,
        "middle_name" varchar(50),
        "position" varchar(100),
        "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING',
        "admin_comment" text,
        "processed_by_account_id" uuid,
        "processed_by_person_id" uuid,
        "processed_at" timestamptz,
        "created_ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pending_registrations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_pending_registrations_login" ON "pending_registrations" (lower("login"))`);
    await q.query(`CREATE INDEX "IDX_pending_registrations_org_status" ON "pending_registrations" ("organization_id", "status")`);
    await q.query(`CREATE INDEX "IDX_pending_registrations_ip" ON "pending_registrations" ("created_ip", "status")`);

    await q.query(`
      CREATE TABLE "pending_changes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "person_id" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
        "requested_by_account_id" uuid NOT NULL,
        "first_name" varchar(50),
        "last_name" varchar(50),
        "middle_name" varchar(50),
        "phone" varchar(16),
        "position" varchar(100),
        "is_mol" boolean,
        "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING',
        "admin_comment" text,
        "processed_by_account_id" uuid,
        "processed_by_person_id" uuid,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pending_changes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_pending_changes_any" CHECK (
          "first_name" IS NOT NULL OR "last_name" IS NOT NULL OR "middle_name" IS NOT NULL
          OR "phone" IS NOT NULL OR "position" IS NOT NULL OR "is_mol" IS NOT NULL
        )
      )`);
    await q.query(`CREATE INDEX "IDX_pending_changes_org_status" ON "pending_changes" ("organization_id", "status")`);
    await q.query(`CREATE INDEX "IDX_pending_changes_person" ON "pending_changes" ("person_id")`);

    await q.query(`
      CREATE TABLE "pending_reset_pass" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
        "status" "public"."request_status_enum" NOT NULL DEFAULT 'PENDING',
        "processed_by_account_id" uuid,
        "processed_by_person_id" uuid,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pending_reset_pass" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_pending_reset_pass_org_status" ON "pending_reset_pass" ("organization_id", "status")`);

    await q.query(`
      CREATE TABLE "email_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "purpose" varchar(30) NOT NULL,
        "code_hash" varchar(255),
        "attempts" smallint NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_codes" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_email_codes_email" ON "email_codes" ("email", "created_at")`);
    await q.query(`CREATE INDEX "IDX_email_codes_ip" ON "email_codes" ("ip", "created_at")`);

    await q.query(`
      CREATE TABLE "audit_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "actor_type" varchar(10) NOT NULL DEFAULT 'user' CHECK ("actor_type" IN ('user', 'system')),
        "account_id" uuid,
        "actor_person_id" uuid,
        "action" varchar(50) NOT NULL,
        "object_type" varchar(30),
        "object_id" uuid,
        "details" jsonb,
        "ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_audit_log_actor" CHECK ("actor_type" = 'system' OR ("account_id" IS NOT NULL AND "actor_person_id" IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX "IDX_audit_log_org_created" ON "audit_log" ("organization_id", "created_at" DESC)`);
    await q.query(`CREATE INDEX "IDX_audit_log_object" ON "audit_log" ("object_id")`);

    await q.query(`
      CREATE TABLE "job_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(50) NOT NULL,
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz,
        "result" jsonb,
        CONSTRAINT "PK_job_runs" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_job_runs_name" ON "job_runs" ("name", "started_at" DESC)`);

    await q.query(`
      CREATE TABLE "rate_limit_hits" (
        "id" bigserial NOT NULL,
        "key" varchar(150) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rate_limit_hits" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_rate_limit_hits_key" ON "rate_limit_hits" ("key", "created_at")`);

    // Справочники ролей и прав
    for (const [code, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      await q.query(`INSERT INTO "permissions" ("code", "description") VALUES ($1, $2)`, [code, description]);
    }
    for (const role of BUILTIN_ROLES) {
      await q.query(
        `INSERT INTO "system_roles" ("id", "code", "name", "is_builtin", "sort_order") VALUES ($1, $2, $3, true, $4)`,
        [role.id, role.code, role.name, role.sortOrder],
      );
      for (const perm of ROLE_PERMISSIONS[role.code]) {
        await q.query(`INSERT INTO "system_role_permissions" ("role_id", "permission_code") VALUES ($1, $2)`, [role.id, perm]);
      }
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'rate_limit_hits', 'job_runs', 'audit_log', 'email_codes', 'pending_reset_pass', 'pending_changes',
      'pending_registrations', 'invites', 'account_person_history', 'accounts', 'system_role_permissions',
      'permissions', 'system_roles', 'persons', 'organizations',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }
    await q.query(`DROP TYPE IF EXISTS "public"."request_status_enum"`);
  }
}
