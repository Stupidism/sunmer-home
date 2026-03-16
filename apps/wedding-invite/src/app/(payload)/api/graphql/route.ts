import configPromise from "@payload-config";
import { GRAPHQL_PLAYGROUND_GET, GRAPHQL_POST } from "@payloadcms/next/routes";

export const GET =
  process.env.NODE_ENV === "production"
    ? () => new Response("Not found", { status: 404 })
    : GRAPHQL_PLAYGROUND_GET(configPromise);
export const POST = GRAPHQL_POST(configPromise);
