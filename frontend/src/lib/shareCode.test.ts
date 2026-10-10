import { describe, expect, it } from "vitest";
import { decodeShareCode, encodeToShareCode, estimateToShareCode, isEstimateShape } from "./shareCode";
import { createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";

describe("encodeToShareCode / decodeShareCode", () => {
  it("round-trips a plain object", () => {
    const value = { a: 1, b: "two", c: [1, 2, 3] };
    expect(decodeShareCode(encodeToShareCode(value))).toEqual(value);
  });

  it("round-trips non-ASCII characters (accents, emoji, currency symbols)", () => {
    const value = { name: "Café René €£¥", note: "launch 🚀 déjà vu" };
    expect(decodeShareCode(encodeToShareCode(value))).toEqual(value);
  });

  it("tolerates whitespace and line breaks introduced by copy-paste", () => {
    const code = encodeToShareCode({ hello: "world" });
    const wrapped = code.slice(0, 10) + "\n" + code.slice(10, 20) + "  \n" + code.slice(20);
    expect(decodeShareCode(wrapped)).toEqual({ hello: "world" });
  });

  it("throws on a string that isn't valid base64", () => {
    expect(() => decodeShareCode("not-valid-base64!!! ###")).toThrow();
  });

  it("throws when the decoded bytes aren't valid JSON", () => {
    const notJson = btoa("this is not json {{{");
    expect(() => decodeShareCode(notJson)).toThrow();
  });
});

describe("isEstimateShape", () => {
  it("accepts a real estimate", () => {
    expect(isEstimateShape(createEstimate(defaultSettings()))).toBe(true);
  });

  it("rejects null, primitives, and arrays", () => {
    expect(isEstimateShape(null)).toBe(false);
    expect(isEstimateShape(undefined)).toBe(false);
    expect(isEstimateShape("estimate")).toBe(false);
    expect(isEstimateShape(42)).toBe(false);
    expect(isEstimateShape([])).toBe(false);
  });

  it("rejects an object missing required sections", () => {
    expect(isEstimateShape({ pricingMethod: "value-based" })).toBe(false);
  });

  it("rejects an unrelated JSON object with a similar top-level shape", () => {
    expect(
      isEstimateShape({
        pricingMethod: "time-materials",
        projectDetails: {},
        rateEffort: {},
        overheadRisk: {},
        assumptions: [],
        exclusions: [],
        expenses: [],
        timeMaterials: { workPackages: [] },
        valueBased: { tiers: [] }, // missing valueDrivers
      }),
    ).toBe(false);
  });

  it("accepts a legacy estimate predating roles/paymentSplit", () => {
    // Estimates saved before role-based pricing and payment-split presets
    // shipped won't have these fields; the shape check must still accept
    // them so normalizeEstimate gets a chance to backfill defaults.
    expect(
      isEstimateShape({
        pricingMethod: "value-based",
        projectDetails: {},
        rateEffort: {},
        overheadRisk: {},
        assumptions: [],
        exclusions: [],
        expenses: [],
        timeMaterials: { workPackages: [] },
        valueBased: { valueDrivers: [], tiers: [] },
      }),
    ).toBe(true);
  });

  it("rejects a bogus pricingMethod value", () => {
    const estimate = createEstimate(defaultSettings());
    expect(isEstimateShape({ ...estimate, pricingMethod: "hourly" })).toBe(false);
  });
});

describe("estimateToShareCode", () => {
  it("produces a code that decodes back to an equivalent estimate", () => {
    const estimate = createEstimate(defaultSettings());
    const code = estimateToShareCode(estimate);
    expect(decodeShareCode(code)).toEqual(estimate);
  });
});
