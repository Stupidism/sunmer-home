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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[db:push] failed:", error);
    process.exit(1);
  });
