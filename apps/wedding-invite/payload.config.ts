import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import { CMSAdmins } from "./src/payload/collections/CMSAdmins";
import { Guests } from "./src/payload/collections/Guests";
import { Invitations } from "./src/payload/collections/Invitations";
import { RSVPs } from "./src/payload/collections/RSVPs";

const databaseURL =
  process.env.PAYLOAD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const payloadSecret =
  process.env.PAYLOAD_SECRET ||
  "wedding-invite-dev-secret-change-me";

const allowSchemaPush = process.env.PAYLOAD_DB_PUSH === "true";

export default buildConfig({
  secret: payloadSecret,
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
    },
    push: allowSchemaPush,
  }),
  admin: {
    user: "cms-admins",
    importMap: {
      autoGenerate: false,
    },
  },
  collections: [CMSAdmins, Guests, Invitations, RSVPs],
});
