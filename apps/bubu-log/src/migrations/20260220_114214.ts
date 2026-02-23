import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_Activity_type" AS ENUM('SLEEP', 'DIAPER', 'BREASTFEED', 'BOTTLE', 'PUMP', 'HEAD_LIFT', 'PASSIVE_EXERCISE', 'ROLL_OVER', 'PULL_TO_SIT', 'GAS_EXERCISE', 'BATH', 'OUTDOOR', 'EARLY_EDUCATION', 'SUPPLEMENT', 'SPIT_UP');
  CREATE TYPE "public"."enum_Activity_poop_color" AS ENUM('YELLOW', 'GREEN', 'BROWN', 'BLACK', 'WHITE', 'RED');
  CREATE TYPE "public"."enum_Activity_pee_amount" AS ENUM('SMALL', 'MEDIUM', 'LARGE');
  CREATE TYPE "public"."enum_Activity_milk_source" AS ENUM('BREAST_MILK', 'FORMULA');
  CREATE TYPE "public"."enum_Activity_breast_firmness" AS ENUM('SOFT', 'ELASTIC', 'HARD');
  CREATE TYPE "public"."enum_Activity_supplement_type" AS ENUM('AD', 'D3');
  CREATE TYPE "public"."enum_Activity_spit_up_type" AS ENUM('NORMAL', 'PROJECTILE');
  CREATE TYPE "public"."enum_AuditLog_action" AS ENUM('CREATE', 'UPDATE', 'DELETE');
  CREATE TYPE "public"."enum_AuditLog_resource_type" AS ENUM('ACTIVITY');
  CREATE TYPE "public"."enum_AuditLog_input_method" AS ENUM('TEXT', 'VOICE');
  CREATE TABLE "Activity" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_Activity_type" NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"baby_id" varchar NOT NULL,
  	"has_poop" boolean,
  	"has_pee" boolean,
  	"poop_color" "enum_Activity_poop_color",
  	"poop_photo_url" varchar,
  	"pee_amount" "enum_Activity_pee_amount",
  	"burp_success" boolean,
  	"milk_amount" numeric,
  	"milk_source" "enum_Activity_milk_source",
  	"breast_firmness" "enum_Activity_breast_firmness",
  	"supplement_type" "enum_Activity_supplement_type",
  	"spit_up_type" "enum_Activity_spit_up_type",
  	"count" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "DailyStat" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"baby_id" varchar NOT NULL,
  	"sleep_count" numeric DEFAULT 0 NOT NULL,
  	"total_sleep_minutes" numeric DEFAULT 0 NOT NULL,
  	"breastfeed_count" numeric DEFAULT 0 NOT NULL,
  	"total_breastfeed_minutes" numeric DEFAULT 0 NOT NULL,
  	"bottle_count" numeric DEFAULT 0 NOT NULL,
  	"total_milk_amount" numeric DEFAULT 0 NOT NULL,
  	"pump_count" numeric DEFAULT 0 NOT NULL,
  	"total_pump_milk_amount" numeric DEFAULT 0 NOT NULL,
  	"diaper_count" numeric DEFAULT 0 NOT NULL,
  	"poop_count" numeric DEFAULT 0 NOT NULL,
  	"pee_count" numeric DEFAULT 0 NOT NULL,
  	"exercise_count" numeric DEFAULT 0 NOT NULL,
  	"total_head_lift_minutes" numeric DEFAULT 0 NOT NULL,
  	"supplement_a_d_count" numeric DEFAULT 0 NOT NULL,
  	"supplement_d3_count" numeric DEFAULT 0 NOT NULL,
  	"spit_up_count" numeric DEFAULT 0 NOT NULL,
  	"projectile_spit_up_count" numeric DEFAULT 0 NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "AuditLog" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"action" "enum_AuditLog_action" DEFAULT 'CREATE' NOT NULL,
  	"resource_type" "enum_AuditLog_resource_type" DEFAULT 'ACTIVITY' NOT NULL,
  	"resource_id" varchar,
  	"input_method" "enum_AuditLog_input_method" NOT NULL,
  	"input_text" varchar,
  	"description" varchar,
  	"success" boolean DEFAULT true NOT NULL,
  	"error_message" varchar,
  	"before_data" jsonb,
  	"after_data" jsonb,
  	"baby_id" varchar,
  	"activity_id" varchar,
  	"user_id" varchar,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "Activity_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "DailyStat_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "AuditLog_id" varchar;
  CREATE INDEX "babyId_idx" ON "Activity" USING btree ("baby_id");
  CREATE INDEX "type_idx" ON "Activity" USING btree ("type");
  CREATE INDEX "startTime_idx" ON "Activity" USING btree ("start_time");
  CREATE INDEX "createdAt_idx" ON "Activity" USING btree ("created_at");
  CREATE UNIQUE INDEX "babyId_date_idx" ON "DailyStat" USING btree ("baby_id","date");
  CREATE INDEX "babyId_1_idx" ON "DailyStat" USING btree ("baby_id");
  CREATE INDEX "date_idx" ON "DailyStat" USING btree ("date");
  CREATE INDEX "babyId_2_idx" ON "AuditLog" USING btree ("baby_id");
  CREATE INDEX "userId_idx" ON "AuditLog" USING btree ("user_id");
  CREATE INDEX "createdAt_1_idx" ON "AuditLog" USING btree ("created_at");
  CREATE INDEX "action_idx" ON "AuditLog" USING btree ("action");
  CREATE INDEX "resourceType_idx" ON "AuditLog" USING btree ("resource_type");
  CREATE INDEX "success_idx" ON "AuditLog" USING btree ("success");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("Activity_id") REFERENCES "public"."Activity"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_stats_fk" FOREIGN KEY ("DailyStat_id") REFERENCES "public"."DailyStat"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("AuditLog_id") REFERENCES "public"."AuditLog"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_Activity_id_idx" ON "payload_locked_documents_rels" USING btree ("Activity_id");
  CREATE INDEX "payload_locked_documents_rels_DailyStat_id_idx" ON "payload_locked_documents_rels" USING btree ("DailyStat_id");
  CREATE INDEX "payload_locked_documents_rels_AuditLog_id_idx" ON "payload_locked_documents_rels" USING btree ("AuditLog_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "Activity" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "DailyStat" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "AuditLog" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "Activity" CASCADE;
  DROP TABLE "DailyStat" CASCADE;
  DROP TABLE "AuditLog" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activities_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_daily_stats_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_logs_fk";
  
  DROP INDEX "payload_locked_documents_rels_Activity_id_idx";
  DROP INDEX "payload_locked_documents_rels_DailyStat_id_idx";
  DROP INDEX "payload_locked_documents_rels_AuditLog_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "Activity_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "DailyStat_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "AuditLog_id";
  DROP TYPE "public"."enum_Activity_type";
  DROP TYPE "public"."enum_Activity_poop_color";
  DROP TYPE "public"."enum_Activity_pee_amount";
  DROP TYPE "public"."enum_Activity_milk_source";
  DROP TYPE "public"."enum_Activity_breast_firmness";
  DROP TYPE "public"."enum_Activity_supplement_type";
  DROP TYPE "public"."enum_Activity_spit_up_type";
  DROP TYPE "public"."enum_AuditLog_action";
  DROP TYPE "public"."enum_AuditLog_resource_type";
  DROP TYPE "public"."enum_AuditLog_input_method";`)
}
