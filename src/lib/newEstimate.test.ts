import { describe, expect, it } from "vitest";
import { cloneEstimate, createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";

describe("createEstimate", () => {
  it("seeds rate, overhead, currency, and preparer from settings", () => {
    const settings = { ...defaultSettings(), dayRate: 1200, overheadPct: 25, currency: "USD", preparerName: "Jane" };
    const estimate = createEstimate(settings);

    expect(estimate.rateEffort.dayRate).toBe(1200);
    expect(estimate.overheadRisk.overheadPct).toBe(25);
    expect(estimate.projectDetails.currency).toBe("USD");
    expect(estimate.projectDetails.preparerName).toBe("Jane");
  });

  it("starts with no pass-through expenses", () => {
    const estimate = createEstimate(defaultSettings());
    expect(estimate.expenses).toEqual([]);
  });

  it("seeds a default 30/40/30 payment split that sums to 100", () => {
    const estimate = createEstimate(defaultSettings());
    const total = estimate.valueBased.paymentSplit.reduce((sum, m) => sum + m.pct, 0);
    expect(total).toBe(100);
  });
});

describe("cloneEstimate", () => {
  it("gives the clone a fresh id and resets status/step, but keeps the content", () => {
    const source = createEstimate(defaultSettings());
    source.projectDetails.estimateName = "Acme Website";
    source.status = "done";
    source.currentStep = 4;

    const clone = cloneEstimate(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.status).toBe("draft");
    expect(clone.currentStep).toBe(1);
    expect(clone.projectDetails.estimateName).toBe("Acme Website (Copy)");
    expect(clone.rateEffort).toEqual(source.rateEffort);
  });

  it("gives every nested item (work packages, value drivers, tiers) a fresh id", () => {
    const source = createEstimate(defaultSettings());
    const clone = cloneEstimate(source);

    expect(clone.timeMaterials.workPackages[0].id).not.toBe(source.timeMaterials.workPackages[0].id);
    expect(clone.valueBased.valueDrivers[0].id).not.toBe(source.valueBased.valueDrivers[0].id);
    clone.valueBased.tiers.forEach((tier, i) => {
      expect(tier.id).not.toBe(source.valueBased.tiers[i].id);
    });
  });

  it("keeps the recommended tier pointing at the corresponding cloned tier", () => {
    const source = createEstimate(defaultSettings());
    const clone = cloneEstimate(source);

    const recommendedIndex = source.valueBased.tiers.findIndex((t) => t.id === source.valueBased.recommendedTierId);
    expect(clone.valueBased.recommendedTierId).toBe(clone.valueBased.tiers[recommendedIndex].id);
  });

  it("leaves an empty estimate name empty instead of appending (Copy)", () => {
    const source = createEstimate(defaultSettings());
    const clone = cloneEstimate(source);
    expect(clone.projectDetails.estimateName).toBe("");
  });

  it("copies the payment split as an independent array, not a shared reference", () => {
    const source = createEstimate(defaultSettings());
    const clone = cloneEstimate(source);

    clone.valueBased.paymentSplit[0].pct = 99;

    expect(clone.valueBased.paymentSplit).not.toBe(source.valueBased.paymentSplit);
    expect(source.valueBased.paymentSplit[0].pct).not.toBe(99);
  });
});
