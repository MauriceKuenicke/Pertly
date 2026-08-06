import { describe, expect, it } from "vitest";
import {
  allocateBudgetByPackage,
  calcBreakEvenEffort,
  calcPaymentMilestones,
  calcRoleBreakdown,
  calcTimeMaterials,
  calcValueBased,
  calcWorkPackage,
  DEFAULT_ROLES,
  matchingPaymentSplitPresetId,
  normalizePaymentSplit,
  normalizeWorkPackageDays,
  PAYMENT_SPLIT_PRESETS,
  resolveWorkPackageDayRate,
  sumExpenses,
  TM_DEFAULT_PAYMENT_SPLIT,
  TM_PAYMENT_SPLIT_PRESETS,
} from "./calc";
import type { ExpenseItem, OverheadRisk, RateEffort, Role, TimeMaterialsData, ValueBasedData, WorkPackage } from "../types/estimate";

function pkg(overrides: Partial<WorkPackage> = {}): WorkPackage {
  return { id: "p1", name: "Package", optimisticDays: 1, likelyDays: 2, pessimisticDays: 4, ...overrides };
}

function tm(
  workPackages: WorkPackage[],
  overrides: Partial<Pick<TimeMaterialsData, "useRoleBasedPricing" | "roles" | "paymentSplit">> = {},
): TimeMaterialsData {
  return { workPackages, useRoleBasedPricing: false, roles: [], paymentSplit: [], ...overrides };
}

describe("normalizeWorkPackageDays", () => {
  it("leaves already-ordered days untouched", () => {
    expect(normalizeWorkPackageDays(pkg())).toEqual(pkg());
  });

  it("pushes likely and pessimistic up when pessimistic is entered below optimistic", () => {
    const result = normalizeWorkPackageDays(pkg({ optimisticDays: 5, likelyDays: 5, pessimisticDays: 2 }));
    expect(result.optimisticDays).toBe(5);
    expect(result.likelyDays).toBe(5);
    expect(result.pessimisticDays).toBe(5);
  });

  it("pushes likely up to optimistic when likely is entered lower", () => {
    const result = normalizeWorkPackageDays(pkg({ optimisticDays: 3, likelyDays: 1, pessimisticDays: 6 }));
    expect(result.optimisticDays).toBe(3);
    expect(result.likelyDays).toBe(3);
    expect(result.pessimisticDays).toBe(6);
  });

  it("clamps negative days to zero", () => {
    const result = normalizeWorkPackageDays(pkg({ optimisticDays: -2, likelyDays: -1, pessimisticDays: -5 }));
    expect(result.optimisticDays).toBe(0);
    expect(result.likelyDays).toBe(0);
    expect(result.pessimisticDays).toBe(0);
  });
});

describe("calcWorkPackage", () => {
  it("computes PERT expected days and sigma", () => {
    const result = calcWorkPackage(pkg({ optimisticDays: 1, likelyDays: 2, pessimisticDays: 4 }), 100);
    expect(result.expectedDays).toBeCloseTo((1 + 4 * 2 + 4) / 6);
    expect(result.sigmaDays).toBeCloseTo((4 - 1) / 6);
    expect(result.cost).toBeCloseTo(result.expectedDays * 100);
  });

  it("never produces a negative sigma, even from an out-of-order input", () => {
    const result = calcWorkPackage(pkg({ optimisticDays: 10, likelyDays: 2, pessimisticDays: 4 }), 100);
    expect(result.sigmaDays).toBeGreaterThanOrEqual(0);
  });
});

describe("calcTimeMaterials", () => {
  const rateEffort: RateEffort = { dayRate: 100, workingHoursPerDay: 8 };
  const overheadRisk: OverheadRisk = { overheadPct: 20, contingencyPct: 10 };

  it("aggregates rows and layers overhead/contingency on top of the total", () => {
    const totals = calcTimeMaterials(tm([pkg({ id: "a" }), pkg({ id: "b" })]), rateEffort, overheadRisk);
    expect(totals.baseCost).toBeCloseTo(totals.rows.reduce((sum, r) => sum + r.cost, 0));
    expect(totals.overheadAmount).toBeCloseTo(totals.baseCost * 0.2);
    expect(totals.deliverySubtotal).toBeCloseTo(totals.baseCost + totals.overheadAmount);
    expect(totals.contingencyAmount).toBeCloseTo(totals.deliverySubtotal * 0.1);
    expect(totals.recommendedBudget).toBeCloseTo(totals.deliverySubtotal + totals.contingencyAmount);
  });

  it("combines package sigma via root-sum-of-squares, not simple addition", () => {
    const totals = calcTimeMaterials(tm([pkg({ id: "a" }), pkg({ id: "b" })]), rateEffort, overheadRisk);
    const perRowSigma = (4 - 1) / 6;
    expect(totals.sigmaDays).toBeCloseTo(Math.sqrt(2 * perRowSigma ** 2));
  });

  it("bases the not-to-exceed cap on the pessimistic case plus overhead and contingency", () => {
    const totals = calcTimeMaterials(tm([pkg({ id: "a" })]), rateEffort, overheadRisk);
    expect(totals.notToExceedCap).toBeCloseTo(totals.totalPessimisticDays * rateEffort.dayRate * 1.2 * 1.1);
  });

  it("never lets the not-to-exceed cap fall below the recommended budget, even for a tight PERT spread", () => {
    // Before the fix, the cap skipped the contingency markup that the
    // recommended budget gets, so a tight optimistic/likely/pessimistic
    // spread (pessimisticCost close to baseCost) could make the "you'll
    // never pay above this" cap lower than the number you're quoting.
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", optimisticDays: 4, likelyDays: 4, pessimisticDays: 4.01 })]),
      rateEffort,
      overheadRisk,
    );
    expect(totals.notToExceedCap).toBeGreaterThanOrEqual(totals.recommendedBudget);
  });

  it("keeps the cap at or above the recommended budget in role-based mode too", () => {
    const roles: Role[] = [
      { id: "junior", name: "Junior", dayRate: 75 },
      { id: "senior", name: "Senior", dayRate: 150 },
    ];
    const totals = calcTimeMaterials(
      tm(
        [
          pkg({ id: "a", roleId: "junior", optimisticDays: 2, likelyDays: 3, pessimisticDays: 3.01 }),
          pkg({ id: "b", roleId: "senior", optimisticDays: 1, likelyDays: 1, pessimisticDays: 1.01 }),
        ],
        { useRoleBasedPricing: true, roles },
      ),
      rateEffort,
      overheadRisk,
    );
    expect(totals.notToExceedCap).toBeGreaterThanOrEqual(totals.recommendedBudget);
  });

  it("handles an empty work package list without dividing by zero", () => {
    const totals = calcTimeMaterials(tm([]), rateEffort, overheadRisk);
    expect(totals.baseCost).toBe(0);
    expect(totals.recommendedBudget).toBe(0);
    expect(Number.isNaN(totals.sigmaDays)).toBe(false);
  });

  it("bills each package at its assigned role's rate in role-based mode", () => {
    const roles: Role[] = [
      { id: "junior", name: "Junior", dayRate: 75 },
      { id: "senior", name: "Senior", dayRate: 150 },
    ];
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", roleId: "junior" }), pkg({ id: "b", roleId: "senior" })], { useRoleBasedPricing: true, roles }),
      rateEffort,
      overheadRisk,
    );
    const a = totals.rows.find((r) => r.id === "a")!;
    const b = totals.rows.find((r) => r.id === "b")!;
    expect(a.dayRate).toBe(75);
    expect(b.dayRate).toBe(150);
    expect(totals.baseCost).toBeCloseTo(a.cost + b.cost);
  });

  it("falls back to the blended rate for a package with no role, or a deleted one, in role-based mode", () => {
    const roles: Role[] = [{ id: "senior", name: "Senior", dayRate: 150 }];
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", roleId: undefined }), pkg({ id: "b", roleId: "does-not-exist" })], {
        useRoleBasedPricing: true,
        roles,
      }),
      rateEffort,
      overheadRisk,
    );
    expect(totals.rows.find((r) => r.id === "a")!.dayRate).toBe(rateEffort.dayRate);
    expect(totals.rows.find((r) => r.id === "b")!.dayRate).toBe(rateEffort.dayRate);
  });

  it("ignores role assignments entirely in blended mode", () => {
    const roles: Role[] = [{ id: "senior", name: "Senior", dayRate: 150 }];
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", roleId: "senior" })], { useRoleBasedPricing: false, roles }),
      rateEffort,
      overheadRisk,
    );
    expect(totals.rows[0].dayRate).toBe(rateEffort.dayRate);
  });
});

describe("resolveWorkPackageDayRate", () => {
  const blendedRate = 900;

  it("returns the blended rate when role-based pricing is off", () => {
    const data = tm([], { useRoleBasedPricing: false, roles: [{ id: "senior", name: "Senior", dayRate: 150 }] });
    expect(resolveWorkPackageDayRate(pkg({ roleId: "senior" }), data, blendedRate)).toBe(blendedRate);
  });

  it("returns the assigned role's rate when role-based pricing is on", () => {
    const data = tm([], { useRoleBasedPricing: true, roles: [{ id: "senior", name: "Senior", dayRate: 150 }] });
    expect(resolveWorkPackageDayRate(pkg({ roleId: "senior" }), data, blendedRate)).toBe(150);
  });

  it("falls back to the blended rate when no role matches", () => {
    const data = tm([], { useRoleBasedPricing: true, roles: [{ id: "senior", name: "Senior", dayRate: 150 }] });
    expect(resolveWorkPackageDayRate(pkg({ roleId: undefined }), data, blendedRate)).toBe(blendedRate);
    expect(resolveWorkPackageDayRate(pkg({ roleId: "ghost" }), data, blendedRate)).toBe(blendedRate);
  });
});

describe("DEFAULT_ROLES", () => {
  it("has the five standard roles with their default EUR day rates", () => {
    expect(DEFAULT_ROLES.map((r) => [r.name, r.dayRate])).toEqual([
      ["Trainee", 0],
      ["Junior", 75],
      ["Mid-level", 95],
      ["Senior", 110],
      ["Principal", 150],
    ]);
  });

  it("has a unique id per role", () => {
    expect(new Set(DEFAULT_ROLES.map((r) => r.id)).size).toBe(DEFAULT_ROLES.length);
  });
});

describe("calcRoleBreakdown", () => {
  const rateEffort: RateEffort = { dayRate: 100, workingHoursPerDay: 8 };
  const roles: Role[] = [
    { id: "junior", name: "Junior", dayRate: 75 },
    { id: "senior", name: "Senior", dayRate: 150 },
  ];

  it("returns nothing in blended mode", () => {
    expect(calcRoleBreakdown(tm([pkg({ roleId: "junior" })], { useRoleBasedPricing: false, roles }), rateEffort)).toEqual([]);
  });

  it("groups cost and days by role, with percentages summing to 100", () => {
    const rows = calcRoleBreakdown(
      tm([pkg({ id: "a", roleId: "junior" }), pkg({ id: "b", roleId: "senior" })], { useRoleBasedPricing: true, roles }),
      rateEffort,
    );
    expect(rows.map((r) => r.roleId)).toEqual(["junior", "senior"]);
    expect(rows.reduce((sum, r) => sum + r.pctOfCost, 0)).toBeCloseTo(100);
  });

  it("omits roles with no assigned work package", () => {
    const rows = calcRoleBreakdown(tm([pkg({ id: "a", roleId: "junior" })], { useRoleBasedPricing: true, roles }), rateEffort);
    expect(rows.map((r) => r.roleId)).toEqual(["junior"]);
  });

  it("groups unassigned packages under a trailing Unassigned row", () => {
    const rows = calcRoleBreakdown(tm([pkg({ id: "a", roleId: undefined })], { useRoleBasedPricing: true, roles }), rateEffort);
    expect(rows).toEqual([
      { roleId: "unassigned", roleName: "Unassigned", dayRate: rateEffort.dayRate, days: rows[0].days, cost: rows[0].cost, pctOfCost: 100 },
    ]);
  });
});

describe("allocateBudgetByPackage", () => {
  const rateEffort: RateEffort = { dayRate: 100, workingHoursPerDay: 8 };
  const overheadRisk: OverheadRisk = { overheadPct: 0, contingencyPct: 0 };

  it("splits the recommended budget proportionally to each package's cost", () => {
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", optimisticDays: 1, likelyDays: 1, pessimisticDays: 1 }), pkg({ id: "b", optimisticDays: 3, likelyDays: 3, pessimisticDays: 3 })]),
      rateEffort,
      overheadRisk,
    );
    const allocations = allocateBudgetByPackage(totals);
    expect(allocations.find((a) => a.id === "b")!.amount).toBeCloseTo(3 * allocations.find((a) => a.id === "a")!.amount);
  });

  it("returns zero amounts instead of NaN when total base cost is zero", () => {
    const totals = calcTimeMaterials(
      tm([pkg({ id: "a", optimisticDays: 0, likelyDays: 0, pessimisticDays: 0 })]),
      rateEffort,
      overheadRisk,
    );
    const allocations = allocateBudgetByPackage(totals);
    expect(allocations).toEqual([{ id: "a", name: "Package", amount: 0 }]);
  });
});

describe("calcValueBased", () => {
  function data(overrides: Partial<ValueBasedData> = {}): ValueBasedData {
    return {
      valueDrivers: [{ id: "d1", label: "Driver", hint: "", annualAmount: 100_000 }],
      conservativePct: 40,
      attributionPct: 80,
      valueCaptureRatePct: 20,
      serviceLines: [],
      tiers: [],
      recommendedTierId: "",
      paymentSplit: [],
      ...overrides,
    };
  }

  it("scales moderate/aggressive off the conservative percentage, clamped to 100%", () => {
    const totals = calcValueBased(data({ conservativePct: 60 }));
    expect(totals.moderatePct).toBe(90);
    expect(totals.aggressivePct).toBe(100); // clamped from 120
  });

  it("derives the fee as conservative value x attribution x capture rate", () => {
    const totals = calcValueBased(data());
    expect(totals.conservativeValue).toBeCloseTo(40_000);
    expect(totals.attributionValue).toBeCloseTo(32_000);
    expect(totals.recommendedFee).toBeCloseTo(6_400);
  });

  it("reports zero ROI instead of dividing by zero when the fee is zero", () => {
    const totals = calcValueBased(data({ valueCaptureRatePct: 0 }));
    expect(totals.recommendedFee).toBe(0);
    expect(totals.clientRoi).toBe(0);
  });
});

describe("calcBreakEvenEffort", () => {
  const rateEffort: RateEffort = { dayRate: 800, workingHoursPerDay: 8 };
  const overheadRisk: OverheadRisk = { overheadPct: 20, contingencyPct: 10 };

  it("marks up the day rate by overhead only, not contingency", () => {
    const result = calcBreakEvenEffort(10_000, rateEffort, overheadRisk);
    expect(result.effectiveDayRate).toBeCloseTo(960); // 800 * 1.2
  });

  it("divides the recommended fee by the effective day rate", () => {
    const result = calcBreakEvenEffort(9_600, rateEffort, overheadRisk);
    expect(result.breakEvenDays).toBeCloseTo(10); // 9600 / 960
  });

  it("returns zero instead of dividing by zero when the day rate is zero", () => {
    const result = calcBreakEvenEffort(5_000, { ...rateEffort, dayRate: 0 }, overheadRisk);
    expect(result.effectiveDayRate).toBe(0);
    expect(result.breakEvenDays).toBe(0);
  });
});

describe("sumExpenses", () => {
  function expense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
    return { id: "e1", label: "Expense", amount: 0, ...overrides };
  }

  it("sums the amount of every expense", () => {
    const total = sumExpenses([expense({ amount: 100 }), expense({ id: "e2", amount: 250 })]);
    expect(total).toBe(350);
  });

  it("returns zero for an empty list", () => {
    expect(sumExpenses([])).toBe(0);
  });
});

describe("calcPaymentMilestones", () => {
  it("splits the total 30/40/30 across three milestones", () => {
    const milestones = calcPaymentMilestones(10_000);
    expect(milestones).toHaveLength(3);
    expect(milestones.map((m) => m.pct)).toEqual([30, 40, 30]);
    expect(milestones.map((m) => m.amount)).toEqual([3_000, 4_000, 3_000]);
  });

  it("adds up to the original total", () => {
    const milestones = calcPaymentMilestones(12_345);
    const sum = milestones.reduce((total, m) => total + m.amount, 0);
    expect(sum).toBeCloseTo(12_345);
  });

  it("handles a zero total without producing NaN", () => {
    const milestones = calcPaymentMilestones(0);
    expect(milestones.every((m) => m.amount === 0)).toBe(true);
  });

  it("uses a custom split when one is provided", () => {
    const milestones = calcPaymentMilestones(1_000, [
      { label: "Half now", pct: 50 },
      { label: "Half later", pct: 50 },
    ]);
    expect(milestones).toEqual([
      { label: "Half now", pct: 50, amount: 500 },
      { label: "Half later", pct: 50, amount: 500 },
    ]);
  });

  it("clamps an over-100% split so the total is never more than 100%", () => {
    const milestones = calcPaymentMilestones(1_000, [
      { label: "A", pct: 70 },
      { label: "B", pct: 70 },
      { label: "C", pct: 30 },
    ]);
    expect(milestones.map((m) => m.pct)).toEqual([70, 30, 0]);
    expect(milestones.reduce((sum, m) => sum + m.pct, 0)).toBe(100);
  });

  it("falls back to the standard split when given an empty split, e.g. an estimate saved before this field existed", () => {
    const milestones = calcPaymentMilestones(1_000, []);
    expect(milestones.map((m) => m.pct)).toEqual([30, 40, 30]);
  });
});

describe("normalizePaymentSplit", () => {
  it("leaves an already-valid split untouched", () => {
    const split = normalizePaymentSplit([
      { label: "A", pct: 30 },
      { label: "B", pct: 40 },
      { label: "C", pct: 30 },
    ]);
    expect(split.map((m) => m.pct)).toEqual([30, 40, 30]);
  });

  it("makes the last entry absorb whatever is left", () => {
    const split = normalizePaymentSplit([
      { label: "A", pct: 20 },
      { label: "B", pct: 100 },
    ]);
    expect(split.map((m) => m.pct)).toEqual([20, 80]);
  });

  it("floors an entry at zero instead of going negative", () => {
    const split = normalizePaymentSplit([
      { label: "A", pct: -10 },
      { label: "B", pct: 50 },
    ]);
    expect(split[0].pct).toBe(0);
  });

  it("always sums to 100 regardless of the input", () => {
    const split = normalizePaymentSplit([
      { label: "A", pct: 999 },
      { label: "B", pct: 999 },
      { label: "C", pct: 999 },
    ]);
    expect(split.reduce((sum, m) => sum + m.pct, 0)).toBe(100);
  });
});

describe("PAYMENT_SPLIT_PRESETS", () => {
  it("has at least one preset, and every preset sums to exactly 100%", () => {
    expect(PAYMENT_SPLIT_PRESETS.length).toBeGreaterThan(0);
    for (const preset of PAYMENT_SPLIT_PRESETS) {
      const total = preset.entries.reduce((sum, entry) => sum + entry.pct, 0);
      expect(total).toBe(100);
    }
  });

  it("has a unique id for every preset", () => {
    const ids = PAYMENT_SPLIT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("TM_PAYMENT_SPLIT_PRESETS", () => {
  it("has at least one preset, and every preset sums to exactly 100%", () => {
    expect(TM_PAYMENT_SPLIT_PRESETS.length).toBeGreaterThan(0);
    for (const preset of TM_PAYMENT_SPLIT_PRESETS) {
      const total = preset.entries.reduce((sum, entry) => sum + entry.pct, 0);
      expect(total).toBe(100);
    }
  });

  it("has a unique id for every preset", () => {
    const ids = TM_PAYMENT_SPLIT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defaults to monthly-in-arrears, the T&M-idiomatic pay-as-you-go pattern", () => {
    expect(TM_PAYMENT_SPLIT_PRESETS[0].id).toBe("monthly-arrears");
    expect(TM_DEFAULT_PAYMENT_SPLIT).toEqual(TM_PAYMENT_SPLIT_PRESETS[0].entries);
  });

  it("is a distinct list from the VBP presets", () => {
    const tmIds = new Set(TM_PAYMENT_SPLIT_PRESETS.map((p) => p.id));
    const vbpIds = PAYMENT_SPLIT_PRESETS.map((p) => p.id);
    expect(vbpIds.some((id) => tmIds.has(id))).toBe(false);
  });
});

describe("matchingPaymentSplitPresetId", () => {
  it("finds the preset that exactly matches a given split", () => {
    const standard = PAYMENT_SPLIT_PRESETS.find((p) => p.id === "standard")!;
    expect(matchingPaymentSplitPresetId(standard.entries)).toBe("standard");
  });

  it("returns null for a split that matches no preset", () => {
    expect(matchingPaymentSplitPresetId([{ label: "Custom", pct: 100 }])).toBeNull();
  });

  it("treats a copy with the same labels and percentages as a match", () => {
    const standard = PAYMENT_SPLIT_PRESETS.find((p) => p.id === "standard")!;
    const copy = standard.entries.map((entry) => ({ ...entry }));
    expect(matchingPaymentSplitPresetId(copy)).toBe("standard");
  });

  it("falls back to standard for a missing or empty split, e.g. an estimate saved before this field existed", () => {
    expect(matchingPaymentSplitPresetId([])).toBe("standard");
    expect(matchingPaymentSplitPresetId(undefined)).toBe("standard");
  });

  it("matches against the T&M preset list when passed explicitly", () => {
    const monthly = TM_PAYMENT_SPLIT_PRESETS.find((p) => p.id === "monthly-arrears")!;
    expect(matchingPaymentSplitPresetId(monthly.entries, TM_PAYMENT_SPLIT_PRESETS)).toBe("monthly-arrears");
    expect(matchingPaymentSplitPresetId([{ label: "Custom", pct: 100 }], TM_PAYMENT_SPLIT_PRESETS)).toBeNull();
  });

  it("falls back to the T&M list's first preset for a missing or empty split", () => {
    expect(matchingPaymentSplitPresetId([], TM_PAYMENT_SPLIT_PRESETS)).toBe("monthly-arrears");
    expect(matchingPaymentSplitPresetId(undefined, TM_PAYMENT_SPLIT_PRESETS)).toBe("monthly-arrears");
  });

  it("does not cross-match a VBP split against the T&M list, or vice versa", () => {
    const standard = PAYMENT_SPLIT_PRESETS.find((p) => p.id === "standard")!;
    expect(matchingPaymentSplitPresetId(standard.entries, TM_PAYMENT_SPLIT_PRESETS)).toBeNull();
  });
});
