import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

type MemoryItem = {
  id: string | number;
  title: string;
  description: string;
  category: "couple" | "baby";
  url: string;
};

function normalizeURL(doc: Record<string, unknown>): string | null {
  if (typeof doc.url === "string" && doc.url.trim()) {
    return doc.url.trim();
  }

  if (typeof doc.filename === "string" && doc.filename.trim()) {
    return `/api/memory-photos/file/${encodeURIComponent(doc.filename)}`;
  }

  return null;
}

export async function GET() {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "memory-photos",
      depth: 0,
      limit: 200,
      sort: "sortOrder",
      overrideAccess: true,
    });

    const items = (result.docs as Array<Record<string, unknown>>)
      .map((doc): MemoryItem | null => {
        const url = normalizeURL(doc);
        if (!url) {
          return null;
        }

        const category = doc.category === "baby" ? "baby" : "couple";
        return {
          id: doc.id as string | number,
          title: typeof doc.title === "string" && doc.title ? doc.title : "我们的回忆",
          description: typeof doc.description === "string" ? doc.description : "",
          category,
          url,
        };
      })
      .filter((item): item is MemoryItem => Boolean(item));

    return NextResponse.json({
      success: true,
      data: {
        couple: items.filter((item) => item.category === "couple"),
        baby: items.filter((item) => item.category === "baby"),
      },
    });
  } catch (error) {
    console.error("Failed to fetch memories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch memories", data: { couple: [], baby: [] } },
      { status: 500 },
    );
  }
}
