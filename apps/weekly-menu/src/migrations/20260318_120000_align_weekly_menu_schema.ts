import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "planner_users_profile_allergies" CASCADE;
    DROP TABLE IF EXISTS "planner_recipes_ingredients" CASCADE;
    DROP TABLE IF EXISTS "planner_recipes" CASCADE;
    DROP TABLE IF EXISTS "user_recipe_submissions" CASCADE;
    DROP TABLE IF EXISTS "weekly_menus" CASCADE;

    ALTER TABLE IF EXISTS "cms_admins"
      DROP COLUMN IF EXISTS "display_name";

    ALTER TABLE IF EXISTS "planner_users"
      DROP COLUMN IF EXISTS "user_id",
      DROP COLUMN IF EXISTS "profile_email",
      DROP COLUMN IF EXISTS "profile_phone",
      DROP COLUMN IF EXISTS "profile_notes";

    ALTER TABLE IF EXISTS "planner_users"
      ALTER COLUMN "role" TYPE varchar(32) USING "role"::text;

    UPDATE "planner_users"
      SET "role" = 'USER'
      WHERE "role" IS NULL;

    ALTER TABLE IF EXISTS "planner_users"
      ALTER COLUMN "role" SET DEFAULT 'USER',
      ALTER COLUMN "role" SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS "planner_users_username_unique_idx"
      ON "planner_users" ("username");

    CREATE TABLE IF NOT EXISTS "dishes" (
      "id" serial PRIMARY KEY NOT NULL,
      "owner_user_id" integer,
      "name" varchar(255) NOT NULL,
      "category" varchar(32) NOT NULL,
      "main_ingredient" varchar(255) NOT NULL,
      "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "dishes_category_check"
        CHECK ("category" IN ('MEAT', 'LEAFY_GREEN', 'OTHER'))
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dishes_owner_user_id_fk'
      ) THEN
        ALTER TABLE "dishes"
          ADD CONSTRAINT "dishes_owner_user_id_fk"
          FOREIGN KEY ("owner_user_id") REFERENCES "planner_users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "dishes_owner_user_id_idx" ON "dishes" ("owner_user_id");
    CREATE INDEX IF NOT EXISTS "dishes_category_idx" ON "dishes" ("category");
    CREATE INDEX IF NOT EXISTS "dishes_is_active_idx" ON "dishes" ("is_active");

    CREATE TABLE IF NOT EXISTS "user_meal_templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "meat_count" integer NOT NULL DEFAULT 1,
      "leafy_green_count" integer NOT NULL DEFAULT 1,
      "other_count" integer NOT NULL DEFAULT 1,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "user_meal_templates_meat_count_check"
        CHECK ("meat_count" BETWEEN 0 AND 3),
      CONSTRAINT "user_meal_templates_leafy_green_count_check"
        CHECK ("leafy_green_count" BETWEEN 0 AND 3),
      CONSTRAINT "user_meal_templates_other_count_check"
        CHECK ("other_count" BETWEEN 0 AND 3)
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_meal_templates_user_id_fk'
      ) THEN
        ALTER TABLE "user_meal_templates"
          ADD CONSTRAINT "user_meal_templates_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "planner_users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "user_meal_templates_user_id_unique_idx"
      ON "user_meal_templates" ("user_id");

    CREATE TABLE IF NOT EXISTS "weekly_plans" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "week_start_date" date NOT NULL,
      "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
      "source_plan_id" integer,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "weekly_plans_status_check"
        CHECK ("status" IN ('DRAFT', 'CONFIRMED'))
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'weekly_plans_user_id_fk'
      ) THEN
        ALTER TABLE "weekly_plans"
          ADD CONSTRAINT "weekly_plans_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "planner_users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'weekly_plans_source_plan_id_fk'
      ) THEN
        ALTER TABLE "weekly_plans"
          ADD CONSTRAINT "weekly_plans_source_plan_id_fk"
          FOREIGN KEY ("source_plan_id") REFERENCES "weekly_plans"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_user_week_unique_idx"
      ON "weekly_plans" ("user_id", "week_start_date");
    CREATE INDEX IF NOT EXISTS "weekly_plans_user_id_idx" ON "weekly_plans" ("user_id");
    CREATE INDEX IF NOT EXISTS "weekly_plans_week_start_idx" ON "weekly_plans" ("week_start_date");

    CREATE TABLE IF NOT EXISTS "meal_slots" (
      "id" serial PRIMARY KEY NOT NULL,
      "plan_id" integer NOT NULL,
      "day_of_week" integer NOT NULL,
      "meal_type" varchar(16) NOT NULL,
      CONSTRAINT "meal_slots_day_of_week_check" CHECK ("day_of_week" BETWEEN 1 AND 7),
      CONSTRAINT "meal_slots_meal_type_check" CHECK ("meal_type" IN ('LUNCH', 'DINNER'))
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meal_slots_plan_id_fk'
      ) THEN
        ALTER TABLE "meal_slots"
          ADD CONSTRAINT "meal_slots_plan_id_fk"
          FOREIGN KEY ("plan_id") REFERENCES "weekly_plans"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "meal_slots_plan_day_type_unique_idx"
      ON "meal_slots" ("plan_id", "day_of_week", "meal_type");
    CREATE INDEX IF NOT EXISTS "meal_slots_plan_id_idx" ON "meal_slots" ("plan_id");

    CREATE TABLE IF NOT EXISTS "meal_dishes" (
      "id" serial PRIMARY KEY NOT NULL,
      "slot_id" integer NOT NULL,
      "dish_id" integer NOT NULL,
      "category_snapshot" varchar(32) NOT NULL,
      "main_ingredient_snapshot" varchar(255) NOT NULL,
      CONSTRAINT "meal_dishes_category_snapshot_check"
        CHECK ("category_snapshot" IN ('MEAT', 'LEAFY_GREEN', 'OTHER'))
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meal_dishes_slot_id_fk'
      ) THEN
        ALTER TABLE "meal_dishes"
          ADD CONSTRAINT "meal_dishes_slot_id_fk"
          FOREIGN KEY ("slot_id") REFERENCES "meal_slots"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meal_dishes_dish_id_fk'
      ) THEN
        ALTER TABLE "meal_dishes"
          ADD CONSTRAINT "meal_dishes_dish_id_fk"
          FOREIGN KEY ("dish_id") REFERENCES "dishes"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "meal_dishes_slot_id_idx" ON "meal_dishes" ("slot_id");
    CREATE INDEX IF NOT EXISTS "meal_dishes_dish_id_idx" ON "meal_dishes" ("dish_id");

    CREATE TABLE IF NOT EXISTS "dish_preferences" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "dish_id" integer NOT NULL,
      "rating" integer NOT NULL DEFAULT 3,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "dish_preferences_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dish_preferences_user_id_fk'
      ) THEN
        ALTER TABLE "dish_preferences"
          ADD CONSTRAINT "dish_preferences_user_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "planner_users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dish_preferences_dish_id_fk'
      ) THEN
        ALTER TABLE "dish_preferences"
          ADD CONSTRAINT "dish_preferences_dish_id_fk"
          FOREIGN KEY ("dish_id") REFERENCES "dishes"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "dish_preferences_user_dish_unique_idx"
      ON "dish_preferences" ("user_id", "dish_id");
    CREATE INDEX IF NOT EXISTS "dish_preferences_user_id_idx" ON "dish_preferences" ("user_id");
    CREATE INDEX IF NOT EXISTS "dish_preferences_dish_id_idx" ON "dish_preferences" ("dish_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "dish_preferences" CASCADE;
    DROP TABLE IF EXISTS "meal_dishes" CASCADE;
    DROP TABLE IF EXISTS "meal_slots" CASCADE;
    DROP TABLE IF EXISTS "weekly_plans" CASCADE;
    DROP TABLE IF EXISTS "user_meal_templates" CASCADE;
    DROP TABLE IF EXISTS "dishes" CASCADE;
  `)
}
