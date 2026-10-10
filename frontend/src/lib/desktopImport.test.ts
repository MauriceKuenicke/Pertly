import { describe, expect, it } from "vitest";
import { MAX_ESTIMATE_BYTES, planDesktopImport } from "./desktopImport";
import { createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";
import type { Estimate } from "../types/estimate";

function estimate(name: string): Estimate {
  const e = createEstimate(defaultSettings());
  return { ...e, projectDetails: { ...e.projectDetails, estimateName: name } };
}

describe("planDesktopImport", () => {
  it("rejects anything that isn't a desktop store", () => {
    expect(() => planDesktopImport(null, [])).toThrow(/estimates\.json/);
    expect(() => planDesktopImport([], [])).toThrow();
    expect(() => planDesktopImport({ foo: 1 }, [])).toThrow();
    expect(() => planDesktopImport({ estimates: "nope" }, [])).toThrow();
  });

  it("keeps file order and original ids", () => {
    const a = estimate("a");
    const b = estimate("b");
    const plan = planDesktopImport({ estimates: [a, b] }, []);
    expect(plan.estimates.map((e) => e.id)).toEqual([a.id, b.id]);
    expect(plan.skipped).toBe(0);
    expect(plan.settings).toBeNull();
  });

  it("skips ids that already exist and duplicates inside the file", () => {
    const a = estimate("a");
    const b = estimate("b");
    const plan = planDesktopImport({ estimates: [a, b, b] }, [a.id]);
    expect(plan.estimates.map((e) => e.id)).toEqual([b.id]);
    expect(plan.skipped).toBe(2);
  });

  it("skips invalid entries and ids the backend would reject", () => {
    const good = estimate("good");
    const badId = { ...estimate("bad id"), id: "has spaces!" };
    const plan = planDesktopImport({ estimates: [good, { hello: "world" }, 42, badId] }, []);
    expect(plan.estimates.map((e) => e.id)).toEqual([good.id]);
    expect(plan.skipped).toBe(3);
  });

  it("normalizes old estimates missing later fields and backfills required metadata", () => {
    const old = estimate("old") as unknown as Record<string, unknown>;
    const tm = { ...(old.timeMaterials as Record<string, unknown>) };
    delete tm.roles;
    delete tm.paymentSplit;
    const legacy = { ...old, timeMaterials: tm, status: undefined, createdAt: undefined };
    const [imported] = planDesktopImport({ estimates: [legacy] }, []).estimates;
    expect(imported.timeMaterials.roles.length).toBeGreaterThan(0);
    expect(imported.timeMaterials.paymentSplit.length).toBeGreaterThan(0);
    expect(imported.status).toBe("draft");
    expect(typeof imported.createdAt).toBe("string");
  });

  it("returns the file's settings document when present", () => {
    const plan = planDesktopImport({ estimates: [], settings: { dayRate: 1200 } }, []);
    expect(plan.settings).toEqual({ dayRate: 1200 });
  });

  it("enforces the backend's id rules: string ids matching ^[A-Za-z0-9_-]{1,64}$", () => {
    const numericId = { ...estimate("numeric"), id: 42 };
    const tooLong = { ...estimate("long"), id: "a".repeat(65) };
    const maxLength = { ...estimate("max"), id: "a".repeat(64) };
    const plan = planDesktopImport({ estimates: [numericId, tooLong, maxLength] }, []);
    expect(plan.estimates.map((e) => e.id)).toEqual(["a".repeat(64)]);
    expect(plan.skipped).toBe(2);
  });

  it("skips estimates the backend would reject as too large (over 512 KiB of JSON)", () => {
    const small = estimate("small");
    const huge = { ...estimate("huge"), assumptions: ["x".repeat(MAX_ESTIMATE_BYTES)] };
    const plan = planDesktopImport({ estimates: [huge, small] }, []);
    expect(plan.estimates.map((e) => e.id)).toEqual([small.id]);
    expect(plan.skipped).toBe(1);
  });
});
