import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Internal revalidation endpoint called by Payload CMS afterChange hooks.
 * Accepts a JSON body with `paths` (array of paths to revalidate) and a `secret`.
 *
 * revalidatePath() from next/cache only works inside a Next.js server context
 * (Route Handlers, Server Actions). Payload CMS hooks run outside this context,
 * so calling revalidatePath directly in hooks is a no-op. This endpoint bridges
 * that gap by providing an HTTP interface that hooks can call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      paths?: string[];
      secret?: string;
    };

    const expectedSecret =
      process.env.REVALIDATION_SECRET || process.env.PAYLOAD_SECRET || "wedding-invite-dev-secret-change-me";

    if (body.secret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Invalid secret" }, { status: 401 });
    }

    const paths = body.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { success: false, error: "paths array is required" },
        { status: 400 },
      );
    }

    const revalidated: string[] = [];
    for (const path of paths) {
      if (typeof path === "string" && path.startsWith("/")) {
        revalidatePath(path);
        revalidated.push(path);
      }
    }

    return NextResponse.json({ success: true, revalidated });
  } catch (error) {
    console.error("[api/revalidate] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
