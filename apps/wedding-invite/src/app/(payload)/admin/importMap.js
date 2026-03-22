import { CollectionCards as CollectionCardsAlias } from "@payloadcms/next/rsc";
import { PolishInvitationButton as PolishInvitationButtonAlias } from "@/payload/components/PolishInvitationButton";
import { VercelBlobClientUploadHandler as VercelBlobClientUploadHandlerAlias } from "@payloadcms/storage-vercel-blob/client";

export const importMap = {
  "@payloadcms/next/rsc#CollectionCards": CollectionCardsAlias,
  "/src/payload/components/PolishInvitationButton#PolishInvitationButton":
    PolishInvitationButtonAlias,
  "@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler":
    VercelBlobClientUploadHandlerAlias,
};
