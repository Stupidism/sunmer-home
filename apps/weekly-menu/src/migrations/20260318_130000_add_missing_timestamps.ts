import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_meal_templates"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;

    ALTER TABLE "meal_slots"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL;

    ALTER TABLE "meal_dishes"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL;

    ALTER TABLE "dish_preferences"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "user_meal_templates"
      DROP COLUMN IF EXISTS "created_at";

    ALTER TABLE "meal_slots"
      DROP COLUMN IF EXISTS "created_at",
      DROP COLUMN IF EXISTS "updated_at";

    ALTER TABLE "meal_dishes"
      DROP COLUMN IF EXISTS "created_at",
      DROP COLUMN IF EXISTS "updated_at";

    ALTER TABLE "dish_preferences"
      DROP COLUMN IF EXISTS "created_at";
  `)
}
