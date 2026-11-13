import type { Json } from "./types";

const privateKeys = new Set([
  "source",
  "source_url",
  "sourceUrl",
  "path",
  "file",
  "filename",
  "fileName",
]);

const absolutePath =
  /(^|[\s("'（【，。；:])(?:~\/|\/(?!\/)|[A-Za-z]:[\\/])\S+/g;

function safeText(value: string): string {
  return value.replace(absolutePath, "$1[路径已隐藏]");
}

export function safeSourceFileLabel(
  value: Json | undefined,
): string | undefined {
  let candidate: string | undefined;
  if (typeof value === "string") candidate = value;
  else if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["label", "filename", "fileName", "file", "path"]) {
      const item = value[key];
      if (typeof item === "string" && item.trim()) {
        candidate = item;
        break;
      }
    }
  }
  const label = candidate
    ?.replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.trim();
  return label ? safeText(label) : undefined;
}

export function sanitizeLedgerJson(value: Json): Json {
  if (typeof value === "string") return safeText(value);
  if (Array.isArray(value)) return value.map(sanitizeLedgerJson);
  if (value && typeof value === "object") {
    const result: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) {
      if (privateKeys.has(key)) continue;
      result[key] = sanitizeLedgerJson(item);
    }
    return result;
  }
  return value;
}

export function sanitizeOptionalLedgerJson(value: Json | null): Json | null {
  return value === null ? null : sanitizeLedgerJson(value);
}
