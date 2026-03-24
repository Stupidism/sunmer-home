import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

type MemoryItem = {
  id: string | number;
  title: string;
  description: string;
  category: "couple" | "baby" | "story";
  url: string;
};

function getBlobBaseUrl(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const match = token.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i);
  if (!match) return null;
  return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
}

function normalizeURL(doc: Record<string, unknown>): string | null {
  const url = typeof doc.url === "string" ? doc.url.trim() : "";
  const filename = typeof doc.filename === "string" ? doc.filename.trim() : "";

  // If URL is already an absolute blob/external URL, use it directly
  if (url.startsWith("https://")) {
    return url;
  }

  // Try to construct a direct Vercel Blob URL
  if (filename) {
    const blobBase = getBlobBaseUrl();
    if (blobBase) {
      return `${blobBase}/${encodeURIComponent(filename)}`;
    }
  }

  // Fallback to Payload's static handler path
  if (url) return url;
  if (filename) return `/api/memory-photos/file/${encodeURIComponent(filename)}`;

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

        const category = doc.category === "baby" ? "baby" : doc.category === "story" ? "story" : "couple";
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
        story: items.filter((item) => item.category === "story"),
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
