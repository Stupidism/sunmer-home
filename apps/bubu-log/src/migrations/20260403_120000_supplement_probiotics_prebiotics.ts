import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."SupplementType" ADD VALUE IF NOT EXISTS 'PROBIOTICS';
    ALTER TYPE "public"."SupplementType" ADD VALUE IF NOT EXISTS 'PREBIOTICS';
    ALTER TABLE "DailyStat" ADD COLUMN IF NOT EXISTS "supplement_probiotics_count" numeric DEFAULT 0 NOT NULL;
    ALTER TABLE "DailyStat" ADD COLUMN IF NOT EXISTS "supplement_prebiotics_count" numeric DEFAULT 0 NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "DailyStat" DROP COLUMN IF EXISTS "supplement_probiotics_count";
    ALTER TABLE "DailyStat" DROP COLUMN IF EXISTS "supplement_prebiotics_count";
  `)
}
