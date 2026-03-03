import configPromise from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import type { Metadata } from "next";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { importMap } from "../importMap";

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Wedding Invite Admin",
};

const Page = async ({ params, searchParams }: Args) => {
  try {
    return await RootPage({
      config: configPromise,
      importMap,
      params,
      searchParams,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.warn(
      "Payload admin init check failed:",
      error instanceof Error ? error.message : "unknown error",
    );

    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Wedding Invite Admin init required</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Payload admin cannot load yet. Ensure preview env uses a valid branch database and run schema push once with
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">PAYLOAD_DB_PUSH=true</code>
          before switching it back to
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">PAYLOAD_DB_PUSH=false</code>.
        </p>
      </main>
    );
  }
};

export default Page;
