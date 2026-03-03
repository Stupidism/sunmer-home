import type { Metadata } from "next";
import { WeddingInvitationPage } from "../../page";
import { getPayloadClient } from "@/lib/payload/client";

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
  return {
    title: `婚礼邀请函 · ${decodeURIComponent(code)}`,
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <WeddingInvitationPage initialInviteCode={decodeURIComponent(code)} />;
}
