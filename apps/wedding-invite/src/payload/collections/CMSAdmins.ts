import type { Access, CollectionConfig } from "payload";

const canCreateAdmin: Access = async ({ req }) => {
  if (req.user) {
    return true;
  }

  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    return false;
  }

  const result = await req.payload.count({
    collection: "cms-admins",
    overrideAccess: true,
  });

  return result.totalDocs === 0;
};

export const CMSAdmins: CollectionConfig = {
  slug: "cms-admins",
  auth: true,
  admin: {
    useAsTitle: "email",
    group: "系统",
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    create: canCreateAdmin,
  },
  fields: [
    {
      name: "displayName",
      label: "显示名",
      type: "text",
    },
  ],
};
