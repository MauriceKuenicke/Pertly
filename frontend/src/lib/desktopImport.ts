import { isEstimateShape } from "./shareCode";
import { normalizeEstimate } from "./newEstimate";
import type { Estimate, Settings } from "../types/estimate";

// Same limits the backend enforces on `PUT /api/estimates/{estimate_id}`:
// anything outside them would be rejected on every save.
const ESTIMATE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_ESTIMATE_BYTES = 512 * 1024;

export interface DesktopImportPlan {
  /** Estimates to add, in file order (file[0] first), already normalized. */
  estimates: Estimate[];
  /** The file's settings document, if it had one. */
  settings: Partial<Settings> | null;
  /** Entries left out: invalid shape, unusable id, too large, or an id that already exists. */
  skipped: number;
}

/**
 * Validates the contents of a Pertly Desktop `estimates.json`
 * (`{ estimates: Estimate[], settings?: Settings }`) and works out which
 * estimates to add to the account. Estimates keep their original ids, so
 * importing the same file twice skips everything the second time.
 *
 * Throws a user-facing Error if the file isn't a desktop store at all.
 */
export function planDesktopImport(data: unknown, existingIds: Iterable<string>): DesktopImportPlan {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray((data as { estimates?: unknown }).estimates)) {
    throw new Error("This file doesn't look like a Pertly Desktop estimates.json.");
  }
  const file = data as { estimates: unknown[]; settings?: unknown };
  const seen = new Set(existingIds);
  const estimates: Estimate[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (const entry of file.estimates) {
    if (!isEstimateShape(entry)) {
      skipped++;
      continue;
    }
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string" || !ESTIMATE_ID_PATTERN.test(id) || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    // The backend rejects documents without status/createdAt/updatedAt;
    // isEstimateShape doesn't check them, so backfill rather than let one
    // odd entry block every later save.
    const raw = entry as Estimate;
    const estimate = normalizeEstimate({
      ...raw,
      status: raw.status === "done" ? "done" : "draft",
      currentStep: raw.currentStep ?? 1,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
    });
    if (new TextEncoder().encode(JSON.stringify(estimate)).length > MAX_ESTIMATE_BYTES) {
      skipped++;
      continue;
    }
    estimates.push(estimate);
  }

  const settings =
    file.settings && typeof file.settings === "object" && !Array.isArray(file.settings)
      ? (file.settings as Partial<Settings>)
      : null;

  return { estimates, settings, skipped };
}
