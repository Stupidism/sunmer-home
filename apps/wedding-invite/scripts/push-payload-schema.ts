import { getPayload } from "payload";
import { Client } from "pg";

const databaseURL =
  process.env.PAYLOAD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;

if (!databaseURL) {
  throw new Error("DATABASE_URL is required");
}

process.env.DATABASE_URL = databaseURL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || databaseURL;
process.env.PAYLOAD_DATABASE_URL = process.env.PAYLOAD_DATABASE_URL || databaseURL;
process.env.PAYLOAD_DB_PUSH = "true";
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = process.env.PAYLOAD_FORCE_DRIZZLE_PUSH || "true";

async function cleanupLegacyRsvpTable() {
  if (process.env.PAYLOAD_AUTO_DROP_LEGACY_RSVP === "false") {
    return;
  }

  const client = new Client({ connectionString: databaseURL });
  await client.connect();

  try {
    const legacy = await client.query<{ exists: boolean }>(
      "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists",
      ["public", "rsvp"],
    );
    const target = await client.query<{ exists: boolean }>(
      "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists",
      ["public", "rsvps"],
    );

    if (legacy.rows[0]?.exists && !target.rows[0]?.exists) {
      await client.query('drop table if exists "public"."rsvp" cascade');
      console.log("[db:push] dropped legacy table public.rsvp");
    }
  } finally {
    await client.end();
  }
}

/**
 * Ensure the merged-from-Invitations columns exist on guests. Payload's
 * interactive schema push sometimes fails to add them in CI, so we add them
 * explicitly here using raw SQL. Idempotent.
 */
async function ensureGuestInvitationColumns() {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();

  try {
    // Check if guests table exists first (it should)
    const tableCheck = await client.query<{ exists: boolean }>(
      "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists",
      ["public", "guests"],
    );
    if (!tableCheck.rows[0]?.exists) {
      console.log("[db:push] guests table does not exist yet, skipping column ensure");
      return;
    }

    // Create enum type for status if not exists
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE enum_guests_status AS ENUM ('draft', 'sent', 'responded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add columns if they don't exist. Use nullable to allow existing rows,
    // then backfill, then tighten constraints.
    await client.query(`
      ALTER TABLE guests
        ADD COLUMN IF NOT EXISTS invite_code varchar,
        ADD COLUMN IF NOT EXISTS share_link varchar,
        ADD COLUMN IF NOT EXISTS max_guest_count numeric DEFAULT 1,
        ADD COLUMN IF NOT EXISTS status enum_guests_status DEFAULT 'draft'
    `);

    // Backfill invite_code from legacy invitations table if it still exists
    const legacyInv = await client.query<{ exists: boolean }>(
      "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists",
      ["public", "invitations"],
    );
    if (legacyInv.rows[0]?.exists) {
      const copyResult = await client.query(`
        UPDATE guests g SET
          invite_code = COALESCE(g.invite_code, i.invite_code),
          share_link = COALESCE(g.share_link, i.share_link),
          max_guest_count = COALESCE(g.max_guest_count, i.max_guest_count, 1),
          status = COALESCE(g.status, i.status::text::enum_guests_status, 'draft'),
          invitation_copy = COALESCE(g.invitation_copy, i.custom_opening)
        FROM invitations i
        WHERE i.guest_id = g.id
      `);
      console.log(`[db:push] backfilled ${copyResult.rowCount} guest(s) from invitations`);
    }

    // Regenerate invite codes that contain non-ASCII characters (e.g. Chinese)
    // because Next.js x-next-cache-tags header doesn't support non-ASCII
    await client.query(`
      UPDATE guests
      SET invite_code = 'guest-' || substr(md5(random()::text || id::text), 1, 12)
      WHERE invite_code ~ '[^\x20-\x7E]'
    `);

    // For any remaining guests still missing invite_code, generate one
    await client.query(`
      UPDATE guests
      SET invite_code = lower(regexp_replace(coalesce(name, 'guest'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text || id::text), 1, 8)
      WHERE invite_code IS NULL OR invite_code = ''
    `);

    // Now make invite_code NOT NULL + UNIQUE
    await client.query(`
      ALTER TABLE guests
        ALTER COLUMN invite_code SET NOT NULL,
        ALTER COLUMN max_guest_count SET NOT NULL,
        ALTER COLUMN status SET NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS guests_invite_code_unique ON guests (invite_code)
    `);

    // Drop legacy invitation_id column from rsvps if it still exists
    await client.query(`
      ALTER TABLE rsvps DROP COLUMN IF EXISTS invitation_id
    `);

    console.log("[db:push] guests invitation columns ensured");
  } finally {
    await client.end();
  }
}

async function main() {
  await cleanupLegacyRsvpTable();
  await ensureGuestInvitationColumns();
  const { default: config } = await import("../payload.config");
  const payload = await getPayload({ config });
  try {
    console.log("[db:push] payload schema push completed");
  } finally {
    if (payload.db && typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[db:push] failed:", error);
    process.exit(1);
  });
