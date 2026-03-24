import type { CollectionConfig } from "payload";
import { isCMSAdmin } from "../access/isCMSAdmin";

export const MemoryPhotos: CollectionConfig = {
  slug: "memory-photos",
  admin: {
    useAsTitle: "title",
    group: "婚礼业务",
    defaultColumns: ["title", "category", "sortOrder", "updatedAt"],
  },
  access: {
    read: () => true,
    create: isCMSAdmin,
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  upload: {
    staticDir: "media",
    mimeTypes: ["image/*"],
  },
  fields: [
    {
      name: "title",
      label: "标题",
      type: "text",
      required: true,
    },
    {
      name: "category",
      label: "照片分类",
      type: "select",
      required: true,
      defaultValue: "couple",
      options: [
        { label: "新郎新娘", value: "couple" },
        { label: "宝宝", value: "baby" },
        { label: "我们的故事", value: "story" },
      ],
    },
    {
      name: "sortOrder",
      label: "排序",
      type: "number",
      defaultValue: 0,
      min: 0,
      admin: {
        description: "数字越小越靠前",
      },
    },
    {
      name: "description",
      label: "说明",
      type: "textarea",
    },
  ],
};
