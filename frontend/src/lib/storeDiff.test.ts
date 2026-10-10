import { describe, expect, it } from "vitest";
import {
  confirmedStore,
  diffStore,
  emptyRejected,
  firstRejection,
  isEmptyDiff,
  pruneRejected,
  withoutRejected,
  type RejectedChanges,
} from "./storeDiff";
import { createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";
import type { Estimate, Store } from "../types/estimate";

function estimate(name: string): Estimate {
  const e = createEstimate(defaultSettings());
  return { ...e, projectDetails: { ...e.projectDetails, estimateName: name } };
}

function store(estimates: Estimate[], settings = defaultSettings()): Store {
  return { estimates, settings };
}

describe("diffStore", () => {
  it("is empty for the identical store", () => {
    const s = store([estimate("a"), estimate("b")]);
    const diff = diffStore(s, s);
    expect(diff).toEqual({ upserts: [], deletes: [], settingsChanged: false });
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("is empty when the arrays differ but every estimate and the settings keep their identity", () => {
    const a = estimate("a");
    const b = estimate("b");
    const settings = defaultSettings();
    const diff = diffStore(store([a, b], settings), store([a, b], settings));
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("upserts a new estimate", () => {
    const a = estimate("a");
    const created = estimate("new");
    const prev = store([a]);
    const diff = diffStore(prev, { ...prev, estimates: [created, a] });
    expect(diff.upserts).toEqual([created]);
    expect(diff.deletes).toEqual([]);
    expect(diff.settingsChanged).toBe(false);
  });

  it("upserts an edited estimate (new object, same id) but not its untouched siblings", () => {
    const a = estimate("a");
    const b = estimate("b");
    const prev = store([a, b]);
    const editedB = { ...b, projectDetails: { ...b.projectDetails, clientName: "ACME" } };
    const diff = diffStore(prev, { ...prev, estimates: [a, editedB] });
    expect(diff.upserts).toEqual([editedB]);
    expect(diff.upserts[0]).toBe(editedB);
  });

  it("treats a structurally equal but re-created object as changed (reference equality)", () => {
    const a = estimate("a");
    const prev = store([a]);
    const diff = diffStore(prev, { ...prev, estimates: [{ ...a }] });
    expect(diff.upserts).toHaveLength(1);
  });

  it("deletes ids missing from next", () => {
    const a = estimate("a");
    const b = estimate("b");
    const c = estimate("c");
    const prev = store([a, b, c]);
    const diff = diffStore(prev, { ...prev, estimates: [b] });
    expect(diff.deletes).toEqual([a.id, c.id]);
    expect(diff.upserts).toEqual([]);
  });

  it("ignores an estimate created and deleted between two syncs", () => {
    const a = estimate("a");
    const prev = store([a]);
    // created then deleted again: never appears in either snapshot
    const diff = diffStore(prev, { ...prev, estimates: [a] });
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("detects a settings change by identity", () => {
    const a = estimate("a");
    const prev = store([a]);
    const diff = diffStore(prev, { ...prev, settings: { ...prev.settings, dayRate: 1000 } });
    expect(diff.settingsChanged).toBe(true);
    expect(diff.upserts).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });

  it("sends multiple new estimates oldest-first (reverse array order) so the server list order matches", () => {
    const existing = estimate("existing");
    const first = estimate("first");
    const second = estimate("second");
    const third = estimate("third");
    const prev = store([existing]);
    // Newest-first array: third was prepended last.
    const next = { ...prev, estimates: [third, second, first, existing] };
    expect(diffStore(prev, next).upserts.map((e) => e.projectDetails.estimateName)).toEqual(["first", "second", "third"]);
  });

  it("orders new estimates before changed existing ones", () => {
    const a = estimate("a");
    const b = estimate("b");
    const prev = store([a, b]);
    const editedB = { ...b, status: "done" as const };
    const new1 = estimate("new1");
    const new2 = estimate("new2");
    const next = { ...prev, estimates: [new2, new1, a, editedB] };
    expect(diffStore(prev, next).upserts).toEqual([new1, new2, editedB]);
  });

  it("combines upserts, deletes and settings in one diff", () => {
    const a = estimate("a");
    const b = estimate("b");
    const prev = store([a, b]);
    const created = estimate("c");
    const editedA = { ...a, currentStep: 2 as const };
    const next = { estimates: [created, editedA], settings: { ...prev.settings, currency: "USD" } };
    expect(diffStore(prev, next)).toEqual({ upserts: [created, editedA], deletes: [b.id], settingsChanged: true });
  });

  it("does not mutate its inputs", () => {
    const a = estimate("a");
    const b = estimate("b");
    const prev = store([a]);
    const nextEstimates = [b, a];
    diffStore(prev, { ...prev, estimates: nextEstimates });
    expect(nextEstimates).toEqual([b, a]);
    expect(prev.estimates).toEqual([a]);
  });
});

const TOO_LARGE = { code: "DOCUMENT_TOO_LARGE", message: "This document is too large to save or export." };

describe("rejected changes", () => {
  function rejectedWith(entries: Estimate[], settings?: Store["settings"]): RejectedChanges {
    const rejected = emptyRejected();
    for (const e of entries) rejected.estimates.set(e.id, { estimate: e, rejection: TOO_LARGE });
    if (settings) rejected.settings = { settings, rejection: TOO_LARGE };
    return rejected;
  }

  it("withoutRejected skips a rejected estimate while its reference is unchanged", () => {
    const a = estimate("a");
    const huge = estimate("huge");
    const prev = store([a]);
    const next = { ...prev, estimates: [huge, a] };
    const diff = withoutRejected(diffStore(prev, next), rejectedWith([huge]), next);
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it("an edit (new reference) gets another try", () => {
    const huge = estimate("huge");
    const prev = store([]);
    const edited = { ...huge, assumptions: [] };
    const next = { ...prev, estimates: [edited] };
    const rejected = pruneRejected(rejectedWith([huge]), next);
    expect(rejected.estimates.size).toBe(0);
    expect(withoutRejected(diffStore(prev, next), rejected, next).upserts).toEqual([edited]);
  });

  it("keeps the other upserts, deletes and settings of the same diff", () => {
    const a = estimate("a");
    const b = estimate("b");
    const huge = estimate("huge");
    const prev = store([a, b]);
    const editedA = { ...a, currentStep: 2 as const };
    const next = { estimates: [huge, editedA], settings: { ...prev.settings, dayRate: 1 } };
    const diff = withoutRejected(diffStore(prev, next), rejectedWith([huge]), next);
    expect(diff).toEqual({ upserts: [editedA], deletes: [b.id], settingsChanged: true });
  });

  it("skips rejected settings until they change again", () => {
    const prev = store([]);
    const badSettings = { ...prev.settings, dayRate: 2 };
    const next = { ...prev, settings: badSettings };
    expect(withoutRejected(diffStore(prev, next), rejectedWith([], badSettings), next).settingsChanged).toBe(false);
    const newer = { ...next, settings: { ...badSettings, dayRate: 3 } };
    const pruned = pruneRejected(rejectedWith([], badSettings), newer);
    expect(pruned.settings).toBeNull();
    expect(withoutRejected(diffStore(prev, newer), pruned, newer).settingsChanged).toBe(true);
  });

  it("confirmedStore keeps the server's version of rejected items, so the next sync doesn't loop", () => {
    const a = estimate("a");
    const b = estimate("b");
    const prev = store([a, b]);
    const huge = estimate("huge");
    const hugeEditOfB = { ...b, assumptions: ["x"] };
    const badSettings = { ...prev.settings, dayRate: 9 };
    const next = { estimates: [huge, a, hugeEditOfB], settings: badSettings };
    const rejected = rejectedWith([huge, hugeEditOfB], badSettings);

    const confirmed = confirmedStore(prev, next, rejected);
    // New rejected estimate never reached the server; rejected edit keeps the old version.
    expect(confirmed.estimates).toEqual([a, b]);
    expect(confirmed.estimates[1]).toBe(b);
    expect(confirmed.settings).toBe(prev.settings);
    // Nothing left to send until the user edits again...
    expect(isEmptyDiff(withoutRejected(diffStore(confirmed, next), pruneRejected(rejected, next), next))).toBe(true);
    // ...but the raw diff still reports unsaved changes (beforeunload / sign-out warnings).
    expect(isEmptyDiff(diffStore(confirmed, next))).toBe(false);
  });

  it("confirmedStore keeps an estimate whose delete was rejected", () => {
    const a = estimate("a");
    const prev = store([a]);
    const next = { ...prev, estimates: [] };
    const rejected = emptyRejected();
    rejected.deletes.set(a.id, { code: "VALIDATION_ERROR", message: "nope" });
    const confirmed = confirmedStore(prev, next, rejected);
    expect(confirmed.estimates).toEqual([a]);
    expect(isEmptyDiff(withoutRejected(diffStore(confirmed, next), rejected, next))).toBe(true);
  });

  it("confirmedStore equals next when nothing was rejected", () => {
    const a = estimate("a");
    const prev = store([]);
    const next = { ...prev, estimates: [a] };
    const confirmed = confirmedStore(prev, next, emptyRejected());
    expect(confirmed.estimates).toEqual([a]);
    expect(confirmed.settings).toBe(next.settings);
    expect(isEmptyDiff(diffStore(confirmed, next))).toBe(true);
  });

  it("pruneRejected drops entries for estimates the user deleted", () => {
    const huge = estimate("huge");
    const pruned = pruneRejected(rejectedWith([huge]), store([]));
    expect(pruned.estimates.size).toBe(0);
  });

  it("firstRejection describes what to show the user", () => {
    expect(firstRejection(emptyRejected())).toBeNull();
    const huge = estimate("Big one");
    expect(firstRejection(rejectedWith([huge]))).toEqual({ kind: "estimate", ...TOO_LARGE, estimateName: "Big one" });
    expect(firstRejection(rejectedWith([], defaultSettings()))).toEqual({ kind: "settings", ...TOO_LARGE });
  });
});
