import type { Access } from "payload";

export const isCMSAdmin: Access = ({ req }) => Boolean(req.user);
