import { createHash } from "node:crypto";

export function stableId(prefix, value) {
  const digest = createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
  return `${prefix}_${digest}`;
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}
