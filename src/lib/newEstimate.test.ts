import { describe, expect, it } from "vitest";
import { cloneEstimate, createEstimate, estimateToShareCode, importEstimateFromShareCode, normalizeEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";
import { encodeToShareCode } from "./shareCode";
import type { Estimate } from "../types/estimate";

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

  it("seeds the role roster and rate mode from settings, defaulting to blended", () => {
    const estimate = createEstimate(defaultSettings());
    expect(estimate.timeMaterials.useRoleBasedPricing).toBe(false);
    expect(estimate.timeMaterials.roles.map((r) => r.name)).toEqual(["Trainee", "Junior", "Mid-level", "Senior", "Principal"]);
    expect(estimate.timeMaterials.workPackages[0].roleId).toBeUndefined();
  });

  it("assigns the first role to the seed work package when role-based pricing is the default", () => {
    const settings = { ...defaultSettings(), useRoleBasedPricing: true };
    const estimate = createEstimate(settings);
    expect(estimate.timeMaterials.useRoleBasedPricing).toBe(true);
    expect(estimate.timeMaterials.workPackages[0].roleId).toBe(estimate.timeMaterials.roles[0].id);
  });

  it("seeds the T&M payment split with the monthly-in-arrears default", () => {
    const estimate = createEstimate(defaultSettings());
    expect(estimate.timeMaterials.paymentSplit).toEqual([{ label: "Billed monthly in arrears (actuals)", pct: 100 }]);
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

  it("gives cloned roles fresh ids and remaps the work package roleId to match", () => {
    const settings = { ...defaultSettings(), useRoleBasedPricing: true };
    const source = createEstimate(settings);
    const clone = cloneEstimate(source);

    expect(clone.timeMaterials.roles[0].id).not.toBe(source.timeMaterials.roles[0].id);
    expect(clone.timeMaterials.useRoleBasedPricing).toBe(true);
    expect(clone.timeMaterials.workPackages[0].roleId).toBe(clone.timeMaterials.roles[0].id);
    expect(clone.timeMaterials.workPackages[0].roleId).not.toBe(source.timeMaterials.workPackages[0].roleId);
  });

  it("copies the T&M payment split as an independent array, not a shared reference", () => {
    const source = createEstimate(defaultSettings());
    const clone = cloneEstimate(source);

    clone.timeMaterials.paymentSplit[0].pct = 42;

    expect(clone.timeMaterials.paymentSplit).not.toBe(source.timeMaterials.paymentSplit);
    expect(source.timeMaterials.paymentSplit[0].pct).not.toBe(42);
  });
});

describe("estimateToShareCode / importEstimateFromShareCode", () => {
  it("round-trips a value-based estimate's content, with a fresh identity", () => {
    const source = createEstimate(defaultSettings());
    source.projectDetails.estimateName = "Acme Website";
    source.projectDetails.clientName = "Acme Corp – Café Division";
    source.status = "done";
    source.currentStep = 4;
    source.valueBased.valueDrivers[0].annualAmount = 250_000;

    const imported = importEstimateFromShareCode(estimateToShareCode(source));

    expect(imported.id).not.toBe(source.id);
    expect(imported.status).toBe("draft");
    expect(imported.currentStep).toBe(1);
    expect(imported.projectDetails.estimateName).toBe("Acme Website");
    expect(imported.projectDetails.clientName).toBe("Acme Corp – Café Division");
    expect(imported.valueBased.valueDrivers[0].annualAmount).toBe(250_000);
    expect(imported.rateEffort).toEqual(source.rateEffort);
  });

  it("does not append (Copy) to the name, unlike cloneEstimate", () => {
    const source = createEstimate(defaultSettings());
    source.projectDetails.estimateName = "Acme Website";

    const imported = importEstimateFromShareCode(estimateToShareCode(source));

    expect(imported.projectDetails.estimateName).toBe("Acme Website");
  });

  it("round-trips a role-based Time & Materials estimate, remapping nested ids", () => {
    const settings = { ...defaultSettings(), useRoleBasedPricing: true };
    const source = createEstimate(settings);
    source.timeMaterials.workPackages[0].name = "Discovery";

    const imported = importEstimateFromShareCode(estimateToShareCode(source));

    expect(imported.timeMaterials.useRoleBasedPricing).toBe(true);
    expect(imported.timeMaterials.workPackages[0].name).toBe("Discovery");
    expect(imported.timeMaterials.workPackages[0].id).not.toBe(source.timeMaterials.workPackages[0].id);
    expect(imported.timeMaterials.roles[0].id).not.toBe(source.timeMaterials.roles[0].id);
    // The role assignment should follow the role through its id remap, not
    // point at the source's (now foreign) role id.
    expect(imported.timeMaterials.workPackages[0].roleId).toBe(imported.timeMaterials.roles[0].id);
  });

  it("gives every nested item a fresh id, mirroring cloneEstimate", () => {
    const source = createEstimate(defaultSettings());
    const imported = importEstimateFromShareCode(estimateToShareCode(source));

    expect(imported.valueBased.valueDrivers[0].id).not.toBe(source.valueBased.valueDrivers[0].id);
    imported.valueBased.tiers.forEach((tier, i) => {
      expect(tier.id).not.toBe(source.valueBased.tiers[i].id);
    });
    const recommendedIndex = source.valueBased.tiers.findIndex((t) => t.id === source.valueBased.recommendedTierId);
    expect(imported.valueBased.recommendedTierId).toBe(imported.valueBased.tiers[recommendedIndex].id);
  });

  it("throws a friendly error for a code that isn't valid base64/JSON", () => {
    expect(() => importEstimateFromShareCode("definitely not a share code")).toThrow(/doesn't look right/);
  });

  it("throws a friendly error for well-formed JSON that isn't a Pertly estimate", () => {
    const code = encodeToShareCode({ hello: "world" });
    expect(() => importEstimateFromShareCode(code)).toThrow(/doesn't look like a Pertly estimate/);
  });

  it("tolerates a share code with incidental whitespace from copy-paste", () => {
    const source = createEstimate(defaultSettings());
    const code = estimateToShareCode(source);
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;

    expect(() => importEstimateFromShareCode(wrapped)).not.toThrow();
  });

  it("imports a legacy estimate predating roles/paymentSplit, backfilling defaults", () => {
    // Mirrors an estimate saved to disk before role-based pricing and
    // payment-split presets existed: timeMaterials only has workPackages,
    // valueBased is missing paymentSplit/serviceLines.
    const legacy = {
      ...createEstimate(defaultSettings()),
      timeMaterials: { workPackages: [] },
      valueBased: { ...createEstimate(defaultSettings()).valueBased, paymentSplit: undefined, serviceLines: undefined },
    } as unknown as Estimate;

    const imported = importEstimateFromShareCode(encodeToShareCode(legacy));

    expect(imported.timeMaterials.roles.length).toBeGreaterThan(0);
    expect(imported.timeMaterials.paymentSplit.length).toBeGreaterThan(0);
    expect(imported.timeMaterials.useRoleBasedPricing).toBe(false);
    expect(imported.valueBased.paymentSplit.length).toBeGreaterThan(0);
    expect(imported.valueBased.serviceLines).toEqual([]);
  });
});

describe("normalizeEstimate", () => {
  it("leaves a current-shape estimate unchanged", () => {
    const estimate = createEstimate(defaultSettings());
    expect(normalizeEstimate(estimate)).toEqual(estimate);
  });

  it("backfills missing timeMaterials fields with sane defaults", () => {
    const estimate = createEstimate(defaultSettings());
    const legacy = { ...estimate, timeMaterials: { workPackages: estimate.timeMaterials.workPackages } } as unknown as Estimate;

    const normalized = normalizeEstimate(legacy);

    expect(normalized.timeMaterials.useRoleBasedPricing).toBe(false);
    expect(normalized.timeMaterials.roles.map((r) => r.name)).toEqual(["Trainee", "Junior", "Mid-level", "Senior", "Principal"]);
    expect(normalized.timeMaterials.paymentSplit).toEqual([{ label: "Billed monthly in arrears (actuals)", pct: 100 }]);
  });

  it("backfills missing valueBased fields with sane defaults", () => {
    const estimate = createEstimate(defaultSettings());
    const { paymentSplit: _paymentSplit, serviceLines: _serviceLines, ...rest } = estimate.valueBased;
    const legacy = { ...estimate, valueBased: rest } as unknown as Estimate;

    const normalized = normalizeEstimate(legacy);

    expect(normalized.valueBased.serviceLines).toEqual([]);
    const total = normalized.valueBased.paymentSplit.reduce((sum, m) => sum + m.pct, 0);
    expect(total).toBe(100);
  });

  it("preserves existing values instead of overwriting them", () => {
    const settings = { ...defaultSettings(), useRoleBasedPricing: true };
    const estimate = createEstimate(settings);
    estimate.timeMaterials.paymentSplit = [{ label: "Custom", pct: 100 }];

    const normalized = normalizeEstimate(estimate);

    expect(normalized.timeMaterials.roles).toEqual(estimate.timeMaterials.roles);
    expect(normalized.timeMaterials.paymentSplit).toEqual([{ label: "Custom", pct: 100 }]);
  });
});
