import config from "../payload.config";
import { getPayload } from "payload";

const email = process.env.E2E_ADMIN_EMAIL || "wedding-e2e-admin@example.com";
const password = process.env.E2E_ADMIN_PASSWORD || "Passw0rd!123456";

async function main() {
  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: "cms-admins",
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs.length === 0) {
    await payload.create({
      collection: "cms-admins",
      data: {
        email,
        password,
        displayName: "Wedding E2E Admin",
      },
      overrideAccess: true,
    });
    console.log(`[seed-e2e-admin] created ${email}`);
  } else {
    console.log(`[seed-e2e-admin] exists ${email}`);
  }

  if (payload.db && typeof payload.db.destroy === "function") {
    await payload.db.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed-e2e-admin] failed:", error);
    process.exit(1);
  });
