import type { Estimate } from "../types/estimate";

/**
 * Estimates are shared as a single opaque, copy-pasteable string:
 * JSON-serialize, then base64-encode via TextEncoder/TextDecoder rather than
 * plain btoa/atob, so non-ASCII characters (accented names, emoji in
 * assumptions, any currency symbol) round-trip correctly instead of
 * throwing or getting mangled.
 */
export function encodeToShareCode(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Inverse of encodeToShareCode. Strips whitespace first, since a code
 * copied out of an email or chat app can pick up wrapped line breaks that
 * would otherwise make atob throw. Throws if the string isn't valid
 * base64, or the decoded bytes aren't valid JSON.
 */
export function decodeShareCode(code: string): unknown {
  const cleaned = code.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/**
 * Minimal structural check on decoded share-code data before it's trusted
 * as an Estimate. Not a full schema validator, just enough to reject
 * "this obviously isn't a Pertly estimate" (garbage paste, truncated copy,
 * JSON from something else) with a clear error instead of a downstream
 * crash or silently broken screen.
 *
 * Deliberately does NOT require timeMaterials.roles/paymentSplit or
 * valueBased.paymentSplit/serviceLines: those fields were added after this
 * app's initial release, so estimates created earlier (and still sitting in
 * someone's local store) won't have them. normalizeEstimate backfills those
 * once a value has passed this check.
 */
export function isEstimateShape(value: unknown): value is Estimate {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;

  if (e.pricingMethod !== "value-based" && e.pricingMethod !== "time-materials") return false;
  if (!isPlainObject(e.projectDetails) || !isPlainObject(e.rateEffort) || !isPlainObject(e.overheadRisk)) return false;
  if (!Array.isArray(e.assumptions) || !Array.isArray(e.exclusions) || !Array.isArray(e.expenses)) return false;

  const tm = e.timeMaterials;
  if (!isPlainObject(tm) || !Array.isArray(tm.workPackages)) return false;

  const vbp = e.valueBased;
  if (!isPlainObject(vbp) || !Array.isArray(vbp.valueDrivers) || !Array.isArray(vbp.tiers)) return false;

  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Encodes an estimate as an opaque, copy-pasteable share code. */
export function estimateToShareCode(estimate: Estimate): string {
  return encodeToShareCode(estimate);
}
