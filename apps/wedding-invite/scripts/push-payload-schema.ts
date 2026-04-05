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
 * One-time backfill: copy invitation data from the legacy `invitations` table
 * into `guests` rows. Runs after schema push so the new columns exist.
 * Idempotent — skips guests that already have an invite_code.
 */
async function backfillInvitationsToGuests() {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();

  try {
    // Check if the legacy invitations table still exists
    const tableCheck = await client.query<{ exists: boolean }>(
      "select exists (select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists",
      ["public", "invitations"],
    );
    if (!tableCheck.rows[0]?.exists) {
      console.log("[backfill] invitations table does not exist, skipping backfill");
      return;
    }

    // Read all invitations
    const { rows } = await client.query<{
      id: number;
      guest_id: number;
      invite_code: string | null;
      share_link: string | null;
      max_guest_count: number | null;
      status: string | null;
      custom_opening: string | null;
    }>("SELECT id, guest_id, invite_code, share_link, max_guest_count, status, custom_opening FROM invitations");

    if (rows.length === 0) {
      console.log("[backfill] No rows in invitations table");
      return;
    }

    console.log(`[backfill] Found ${rows.length} invitation(s) to migrate`);
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.guest_id || !row.invite_code) {
        skipped++;
        continue;
      }

      // Skip if guest already has an invite_code
      const existing = await client.query<{ invite_code: string | null }>(
        "SELECT invite_code FROM guests WHERE id = $1",
        [row.guest_id],
      );
      if (existing.rows[0]?.invite_code) {
        skipped++;
        continue;
      }

      await client.query(
        `UPDATE guests SET
          invite_code = COALESCE($1, invite_code),
          max_guest_count = COALESCE($2, max_guest_count),
          status = COALESCE($3, status),
          invitation_copy = COALESCE($4, invitation_copy)
        WHERE id = $5`,
        [row.invite_code, row.max_guest_count, row.status, row.custom_opening, row.guest_id],
      );
      updated++;
    }

    console.log(`[backfill] Done: updated=${updated}, skipped=${skipped}`);
  } finally {
    await client.end();
  }
}

async function main() {
  await cleanupLegacyRsvpTable();
  const { default: config } = await import("../payload.config");
  const payload = await getPayload({ config });
  try {
    console.log("[db:push] payload schema push completed");
  } finally {
    if (payload.db && typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
  // Run backfill after schema push so new columns exist on guests
  await backfillInvitationsToGuests();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[db:push] failed:", error);
    process.exit(1);
  });
