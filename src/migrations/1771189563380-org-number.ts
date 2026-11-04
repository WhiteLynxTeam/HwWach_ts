import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomOrgNumber } from '../common/org-number';

// Номер организации и логин внутри организации (org-roles-plan.md, 9.2, этап 10):
// - organizations.number — 6 случайных цифр + контрольная (Луна), уникален; уже созданным выдаётся сейчас;
// - логин уникален среди активных учётных записей организации, а не всей системы; почта — по-прежнему во всей;
// - заявка может прийти по номеру организации (source = number).
export class OrgNumber1771189563380 implements MigrationInterface {
  name = 'OrgNumber1771189563380';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "number" varchar(7)`);
    const orgs: { id: string }[] = await q.query(`SELECT "id" FROM "organizations" WHERE "number" IS NULL`);
    const used = new Set<string>((await q.query(`SELECT "number" FROM "organizations" WHERE "number" IS NOT NULL`)).map((r: { number: string }) => r.number));
    for (const o of orgs) {
      let n = randomOrgNumber();
      while (used.has(n)) n = randomOrgNumber();
      used.add(n);
      await q.query(`UPDATE "organizations" SET "number" = $1 WHERE "id" = $2`, [n, o.id]);
    }
    await q.query(`ALTER TABLE "organizations" ALTER COLUMN "number" SET NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX "UQ_organizations_number" ON "organizations" ("number")`);

    await q.query(`DROP INDEX IF EXISTS "UQ_accounts_login_active"`);
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_org_login_active" ON "accounts" ("organization_id", lower("login")) WHERE "is_active"`);

    await this.setSourceCheck(q, `('invite', 'search', 'number')`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "pending_registrations" WHERE "source" = 'number'`);
    await this.setSourceCheck(q, `('invite', 'search')`);
    // Обратно к уникальности во всей системе: при одинаковых логинах в разных организациях не применится
    await q.query(`DROP INDEX IF EXISTS "UQ_accounts_org_login_active"`);
    await q.query(`CREATE UNIQUE INDEX "UQ_accounts_login_active" ON "accounts" (lower("login")) WHERE "is_active"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_organizations_number"`);
    await q.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "number"`);
  }

  // Ограничение на source создано без имени (CHECK в CREATE TABLE) — находим его по определению
  private async setSourceCheck(q: QueryRunner, values: string): Promise<void> {
    const checks: { conname: string }[] = await q.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'pending_registrations'::regclass AND contype = 'c'
         AND pg_get_constraintdef(oid) LIKE '%source%'`,
    );
    for (const c of checks) {
      await q.query(`ALTER TABLE "pending_registrations" DROP CONSTRAINT "${c.conname}"`);
    }
    await q.query(`ALTER TABLE "pending_registrations" ADD CONSTRAINT "CHK_pending_registrations_source" CHECK ("source" IN ${values})`);
  }
}
