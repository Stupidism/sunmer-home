/**
 * Triggers page revalidation by calling the /api/revalidate endpoint via HTTP.
 *
 * revalidatePath() from next/cache only works inside a Next.js server context
 * (Route Handlers, Server Actions). Payload CMS hooks run outside this context,
 * so we need to make an HTTP call to a Route Handler that calls revalidatePath().
 */
export async function triggerRevalidation(paths: string[]): Promise<void> {
  const secret =
    process.env.REVALIDATION_SECRET || process.env.PAYLOAD_SECRET || "wedding-invite-dev-secret-change-me";
  const siteURL = (
    process.env.WEDDING_INVITE_SITE_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${siteURL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, secret }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(
        `[triggerRevalidation] HTTP ${response.status} for paths ${JSON.stringify(paths)}: ${text}`,
      );
    }
  } catch (error) {
    console.warn("[triggerRevalidation] failed:", error);
  }
}
