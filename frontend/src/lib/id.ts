/**
 * Random RFC 4122 version-4 UUID. Uses `crypto.randomUUID` where available;
 * it only exists in secure contexts (https:// or localhost), so on an
 * internal server reached over plain http:// we build the same format from
 * `crypto.getRandomValues`, which is available everywhere.
 */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return uuidV4FromRandomValues();
}

export function uuidV4FromRandomValues(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
