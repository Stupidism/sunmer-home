import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3212";
const isRemoteBaseURL = /^https?:\/\//.test(baseURL) && !baseURL.includes("127.0.0.1") && !baseURL.includes("localhost");
const databaseURL =
  process.env.PAYLOAD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const adminEmail = process.env.E2E_ADMIN_EMAIL || "wedding-e2e-admin@example.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Passw0rd!123456";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["html", { outputFolder: "./playwright-report" }], ["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: isRemoteBaseURL
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 3212",
        cwd: ".",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          PAYLOAD_DATABASE_URL: databaseURL,
          DATABASE_URL: databaseURL,
          DATABASE_URL_UNPOOLED: databaseURL,
          PAYLOAD_DB_PUSH: "true",
          PAYLOAD_SECRET: "wedding-e2e-secret",
          ALLOW_ADMIN_BOOTSTRAP: "true",
          E2E_ADMIN_EMAIL: adminEmail,
          E2E_ADMIN_PASSWORD: adminPassword,
          WEDDING_INVITE_SITE_URL: baseURL,
        },
      },
});
