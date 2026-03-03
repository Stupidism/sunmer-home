import { CollectionCards as CollectionCardsAlias } from "@payloadcms/next/rsc";
import { PolishInvitationButton as PolishInvitationButtonAlias } from "@/payload/components/PolishInvitationButton";

export const importMap = {
  "@payloadcms/next/rsc#CollectionCards": CollectionCardsAlias,
  "/src/payload/components/PolishInvitationButton#PolishInvitationButton":
    PolishInvitationButtonAlias,
};
