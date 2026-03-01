import { execSync } from "node:child_process";

async function globalSetup() {
  const databaseURL =
    process.env.PAYLOAD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

  const env = {
    ...process.env,
    PAYLOAD_DATABASE_URL: databaseURL,
    DATABASE_URL: databaseURL,
    DATABASE_URL_UNPOOLED: databaseURL,
    PAYLOAD_DB_PUSH: "true",
    PAYLOAD_SECRET: "wedding-e2e-secret",
    ALLOW_ADMIN_BOOTSTRAP: "true",
    E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || "wedding-e2e-admin@example.com",
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || "Passw0rd!123456",
  };

  execSync("pnpm --filter wedding-invite seed:e2e-admin", {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}

export default globalSetup;
