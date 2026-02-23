import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_User_role" AS ENUM('ADMIN', 'DAD', 'MOM', 'NANNY', 'GRANDPARENT', 'OTHER');
  CREATE TYPE "public"."enum_Baby_gender" AS ENUM('BOY', 'GIRL', 'OTHER');
  CREATE TABLE "cms_admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "cms_admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "User" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"username" varchar NOT NULL,
  	"password" varchar,
  	"name" varchar,
  	"email" varchar,
  	"image" varchar,
  	"email_verified" timestamp(3) with time zone,
  	"role" "enum_User_role" DEFAULT 'OTHER' NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "Baby" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"avatar_url" varchar,
  	"birth_date" timestamp(3) with time zone,
  	"gender" "enum_Baby_gender" DEFAULT 'OTHER' NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "BabyUser" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"baby_id_id" varchar NOT NULL,
  	"user_id_id" varchar NOT NULL,
  	"is_default" boolean DEFAULT false,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_admins_id" integer,
  	"User_id" varchar,
  	"Baby_id" varchar,
  	"BabyUser_id" varchar
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_admins_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms_admins_sessions" ADD CONSTRAINT "cms_admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "BabyUser" ADD CONSTRAINT "BabyUser_baby_id_id_Baby_id_fk" FOREIGN KEY ("baby_id_id") REFERENCES "public"."Baby"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "BabyUser" ADD CONSTRAINT "BabyUser_user_id_id_User_id_fk" FOREIGN KEY ("user_id_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_admins_fk" FOREIGN KEY ("cms_admins_id") REFERENCES "public"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_app_users_fk" FOREIGN KEY ("User_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_babies_fk" FOREIGN KEY ("Baby_id") REFERENCES "public"."Baby"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_baby_users_fk" FOREIGN KEY ("BabyUser_id") REFERENCES "public"."BabyUser"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_admins_fk" FOREIGN KEY ("cms_admins_id") REFERENCES "public"."cms_admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cms_admins_sessions_order_idx" ON "cms_admins_sessions" USING btree ("_order");
  CREATE INDEX "cms_admins_sessions_parent_id_idx" ON "cms_admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "cms_admins_updated_at_idx" ON "cms_admins" USING btree ("updated_at");
  CREATE INDEX "cms_admins_created_at_idx" ON "cms_admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_admins_email_idx" ON "cms_admins" USING btree ("email");
  CREATE UNIQUE INDEX "User_username_idx" ON "User" USING btree ("username");
  CREATE UNIQUE INDEX "User_email_idx" ON "User" USING btree ("email");
  CREATE INDEX "BabyUser_baby_id_idx" ON "BabyUser" USING btree ("baby_id_id");
  CREATE INDEX "BabyUser_user_id_idx" ON "BabyUser" USING btree ("user_id_id");
  CREATE UNIQUE INDEX "babyId_userId_idx" ON "BabyUser" USING btree ("baby_id_id","user_id_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_admins_id_idx" ON "payload_locked_documents_rels" USING btree ("cms_admins_id");
  CREATE INDEX "payload_locked_documents_rels_User_id_idx" ON "payload_locked_documents_rels" USING btree ("User_id");
  CREATE INDEX "payload_locked_documents_rels_Baby_id_idx" ON "payload_locked_documents_rels" USING btree ("Baby_id");
  CREATE INDEX "payload_locked_documents_rels_BabyUser_id_idx" ON "payload_locked_documents_rels" USING btree ("BabyUser_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_admins_id_idx" ON "payload_preferences_rels" USING btree ("cms_admins_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms_admins_sessions" CASCADE;
  DROP TABLE "cms_admins" CASCADE;
  DROP TABLE "User" CASCADE;
  DROP TABLE "Baby" CASCADE;
  DROP TABLE "BabyUser" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_User_role";
  DROP TYPE "public"."enum_Baby_gender";`)
}
