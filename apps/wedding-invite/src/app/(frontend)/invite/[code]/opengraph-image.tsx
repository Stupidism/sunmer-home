import { ImageResponse } from "next/og";
import {
  buildInviteShareTitle,
  buildInviteShareDescription,
  decodeInviteCode,
  getInviteShareMeta,
} from "./share-meta";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decodedCode = decodeInviteCode(code);
  const { guestName, hostRole } = await getInviteShareMeta(decodedCode);
  const title = buildInviteShareTitle(guestName, hostRole);
  const description = buildInviteShareDescription();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "radial-gradient(1200px 630px at 20% 20%, #fde7f3 0%, #f6d9e8 28%, #f3cfe0 55%, #eec6da 100%)",
          color: "#5f2f43",
          fontFamily: "Noto Sans SC, sans-serif",
          padding: "64px 72px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 34,
              letterSpacing: 1,
              opacity: 0.8,
            }}
          >
            Wedding Invitation
          </div>
          <div
            style={{
              fontSize: 66,
              lineHeight: 1.18,
              fontWeight: 700,
              maxWidth: "100%",
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.35,
              opacity: 0.9,
            }}
          >
            {description}
          </div>
          <div
            style={{
              fontSize: 26,
              opacity: 0.75,
            }}
          >
            2026.05.05 · 江苏东台
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
