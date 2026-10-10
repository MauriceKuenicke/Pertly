import type { Estimate, Settings, Store } from "../types/estimate";

export interface StoreDiff {
  /** Estimates to PUT, in the order they must be sent. */
  upserts: Estimate[];
  /** Ids of estimates to DELETE. */
  deletes: string[];
  settingsChanged: boolean;
}

/**
 * What changed between the last state the server confirmed (`prev`) and the
 * current in-memory store (`next`).
 *
 * Uses reference equality: every store update is immutable and unchanged
 * estimates keep their identity, so `prev.x !== next.x` means "edited".
 *
 * Order matters for brand-new estimates: the store array is newest-first and
 * the backend puts every newly created row at the top of its list, so new
 * estimates are sent oldest-first (reverse array order). That way the list
 * comes back from the server in the same order the user sees now. Changed
 * existing estimates follow; their server-side position never moves.
 */
export function diffStore(prev: Store, next: Store): StoreDiff {
  const prevById = new Map(prev.estimates.map((e) => [e.id, e]));
  const nextIds = new Set(next.estimates.map((e) => e.id));

  const created: Estimate[] = [];
  const changed: Estimate[] = [];
  for (const estimate of next.estimates) {
    const before = prevById.get(estimate.id);
    if (!before) created.push(estimate);
    else if (before !== estimate) changed.push(estimate);
  }
  created.reverse();

  return {
    upserts: [...created, ...changed],
    deletes: prev.estimates.filter((e) => !nextIds.has(e.id)).map((e) => e.id),
    settingsChanged: prev.settings !== next.settings,
  };
}

export function isEmptyDiff(diff: StoreDiff): boolean {
  return diff.upserts.length === 0 && diff.deletes.length === 0 && !diff.settingsChanged;
}

// --- permanently rejected changes -----------------------------------------

/** Why the server refused a change for good (4xx other than 401/408/429). */
export interface Rejection {
  code: string;
  message: string;
}

/**
 * Changes the server refused and that must not be re-sent until the user
 * edits them again. Keyed by object identity: a new edit produces a new
 * reference, which no longer matches, so it gets another try.
 */
export interface RejectedChanges {
  estimates: Map<string, { estimate: Estimate; rejection: Rejection }>;
  deletes: Map<string, Rejection>;
  settings: { settings: Settings; rejection: Rejection } | null;
}

export function emptyRejected(): RejectedChanges {
  return { estimates: new Map(), deletes: new Map(), settings: null };
}

/** Drops rejections whose object has since been edited (or deleted), so those changes are retried. */
export function pruneRejected(rejected: RejectedChanges, current: Store): RejectedChanges {
  const currentById = new Map(current.estimates.map((e) => [e.id, e]));
  const estimates = new Map(
    Array.from(rejected.estimates).filter(([id, entry]) => currentById.get(id) === entry.estimate),
  );
  const deletes = new Map(Array.from(rejected.deletes).filter(([id]) => !currentById.has(id)));
  const settings = rejected.settings && rejected.settings.settings === current.settings ? rejected.settings : null;
  return { estimates, deletes, settings };
}

/** `diff` minus everything that was already rejected in its current form. */
export function withoutRejected(diff: StoreDiff, rejected: RejectedChanges, next: Store): StoreDiff {
  return {
    upserts: diff.upserts.filter((e) => rejected.estimates.get(e.id)?.estimate !== e),
    deletes: diff.deletes.filter((id) => !rejected.deletes.has(id)),
    settingsChanged: diff.settingsChanged && rejected.settings?.settings !== next.settings,
  };
}

/**
 * What the server holds after successfully syncing `next` on top of `base`,
 * except for the rejected changes (those keep their `base` version, or stay
 * absent if they never reached the server). Becomes the new diff baseline.
 */
export function confirmedStore(base: Store, next: Store, rejected: RejectedChanges): Store {
  const baseById = new Map(base.estimates.map((e) => [e.id, e]));
  const nextIds = new Set(next.estimates.map((e) => e.id));
  const estimates: Estimate[] = [];
  for (const estimate of next.estimates) {
    if (rejected.estimates.get(estimate.id)?.estimate === estimate) {
      const before = baseById.get(estimate.id);
      if (before) estimates.push(before);
    } else {
      estimates.push(estimate);
    }
  }
  for (const id of rejected.deletes.keys()) {
    const before = baseById.get(id);
    if (before && !nextIds.has(id)) estimates.push(before);
  }
  const settingsRejected = rejected.settings !== null && rejected.settings.settings === next.settings;
  return { estimates, settings: settingsRejected ? base.settings : next.settings };
}

export interface SaveRejection extends Rejection {
  kind: "estimate" | "settings";
  /** Name of the rejected estimate, when kind is "estimate". */
  estimateName?: string;
}

/** The rejection to show the user, or null if nothing is currently rejected. */
export function firstRejection(rejected: RejectedChanges): SaveRejection | null {
  const [estimateEntry] = rejected.estimates.values();
  if (estimateEntry) {
    return {
      kind: "estimate",
      ...estimateEntry.rejection,
      estimateName: estimateEntry.estimate.projectDetails?.estimateName || "Untitled estimate",
    };
  }
  if (rejected.settings) return { kind: "settings", ...rejected.settings.rejection };
  const [deleteRejection] = rejected.deletes.values();
  if (deleteRejection) return { kind: "estimate", ...deleteRejection };
  return null;
}
