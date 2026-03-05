import type { Metadata } from "next";
import { WeddingInvitationPage } from "../../page";
import { getPayloadClient } from "@/lib/payload/client";
import {
  buildInviteShareDescription,
  buildInviteShareTitle,
  decodeInviteCode,
  getInviteShareMeta,
} from "./share-meta";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<Array<{ code: string }>> {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "invitations",
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    });

    return result.docs
      .map((doc) => (typeof doc.inviteCode === "string" ? doc.inviteCode : null))
      .filter((code): code is string => Boolean(code))
      .map((code) => ({ code }));
  } catch (error) {
    console.warn("[invite/[code]] generateStaticParams failed:", error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const decodedCode = decodeInviteCode(code);
  const siteURL = (process.env.WEDDING_INVITE_SITE_URL || "https://wedding.sunmer.xyz").replace(/\/$/, "");
  const { guestName, hostRole } = await getInviteShareMeta(decodedCode);

  const title = buildInviteShareTitle(guestName, hostRole);
  const description = buildInviteShareDescription();
  const pageURL = `${siteURL}/invite/${encodeURIComponent(decodedCode)}`;
  const imageURL = `${siteURL}/invite/${encodeURIComponent(decodedCode)}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: pageURL,
    },
    icons: {
      icon: [
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
    },
    openGraph: {
      title,
      description,
      url: pageURL,
      type: "website",
      images: [
        {
          url: imageURL,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageURL],
    },
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <WeddingInvitationPage initialInviteCode={decodeInviteCode(code)} />;
}
