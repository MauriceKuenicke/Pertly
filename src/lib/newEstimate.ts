import { createId } from "./id";
import { DEFAULT_PAYMENT_SPLIT } from "./calc";
import type { Estimate, Settings } from "../types/estimate";

export function createEstimate(settings: Settings): Estimate {
  const now = new Date().toISOString();
  const tierBId = createId();

  return {
    id: createId(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    pricingMethod: "value-based",
    projectDetails: {
      estimateName: "",
      clientName: "",
      currency: settings.currency,
      preparerName: settings.preparerName,
    },
    rateEffort: {
      dayRate: settings.dayRate,
      workingHoursPerDay: settings.workingHoursPerDay,
    },
    overheadRisk: {
      overheadPct: settings.overheadPct,
      contingencyPct: settings.contingencyPct,
    },
    assumptions: ["Client provides timely access to systems, data and stakeholders."],
    exclusions: ["Third-party licence and hosting costs are not included."],
    expenses: [],
    timeMaterials: {
      workPackages: [
        { id: createId(), name: "", optimisticDays: 1, likelyDays: 2, pessimisticDays: 4 },
      ],
    },
    valueBased: {
      valueDrivers: [
        { id: createId(), label: "Time wasted / year", hint: "People affected × hrs/week × 50 × hourly rate", annualAmount: 0 },
        { id: createId(), label: "Errors & rework / year", hint: "Incidents × cost per incident", annualAmount: 0 },
        { id: createId(), label: "Revenue drag / year", hint: "Lost or delayed revenue × 4 quarters", annualAmount: 0 },
        { id: createId(), label: "Compliance / risk / year", hint: "Penalty potential × likelihood", annualAmount: 0 },
        { id: createId(), label: "Opportunity cost / year", hint: "Delayed initiatives, market share", annualAmount: 0 },
      ],
      conservativePct: settings.conservativePct,
      attributionPct: settings.attributionPct,
      valueCaptureRatePct: settings.valueCaptureRatePct,
      serviceLines: [],
      tiers: [
        { id: createId(), name: "Tier A", durationMinWeeks: 3, durationMaxWeeks: 4, price: 0, description: "" },
        { id: tierBId, name: "Tier B", durationMinWeeks: 8, durationMaxWeeks: 12, price: 0, description: "" },
        { id: createId(), name: "Tier C", durationMinWeeks: 16, durationMaxWeeks: 24, price: 0, description: "" },
      ],
      recommendedTierId: tierBId,
      paymentSplit: DEFAULT_PAYMENT_SPLIT.map((entry) => ({ ...entry })),
    },
  };
}

/**
 * Duplicates an existing estimate as a starting point for a new one: fresh
 * id (and fresh ids for every nested list item, so React keys and the
 * recommended-tier reference never collide with the source), reset to a
 * draft at step 1 so the client/project details get updated first.
 */
export function cloneEstimate(source: Estimate): Estimate {
  const now = new Date().toISOString();
  const tierIdMap = new Map(source.valueBased.tiers.map((tier) => [tier.id, createId()]));

  return {
    ...source,
    id: createId(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    projectDetails: {
      ...source.projectDetails,
      estimateName: source.projectDetails.estimateName ? `${source.projectDetails.estimateName} (Copy)` : "",
    },
    assumptions: [...source.assumptions],
    exclusions: [...source.exclusions],
    expenses: source.expenses.map((expense) => ({ ...expense, id: createId() })),
    timeMaterials: {
      workPackages: source.timeMaterials.workPackages.map((pkg) => ({ ...pkg, id: createId() })),
    },
    valueBased: {
      ...source.valueBased,
      serviceLines: [...source.valueBased.serviceLines],
      valueDrivers: source.valueBased.valueDrivers.map((driver) => ({ ...driver, id: createId() })),
      tiers: source.valueBased.tiers.map((tier) => ({ ...tier, id: tierIdMap.get(tier.id)! })),
      recommendedTierId: tierIdMap.get(source.valueBased.recommendedTierId) ?? source.valueBased.recommendedTierId,
      paymentSplit: source.valueBased.paymentSplit.map((entry) => ({ ...entry })),
    },
  };
}
