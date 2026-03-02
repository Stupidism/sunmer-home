import { getPayload } from "payload";

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

async function main() {
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
