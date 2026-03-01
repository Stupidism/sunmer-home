import config from "../payload.config";
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

async function main() {
  process.env.PAYLOAD_MIGRATING = "true";

  const payload = await getPayload({ config });
  try {
    await payload.db.migrate({});
    console.log("[db:migrate] payload migrations completed");
  } finally {
    if (payload.db && typeof payload.db.destroy === "function") {
      await payload.db.destroy();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[db:migrate] failed:", error);
    process.exit(1);
  });
