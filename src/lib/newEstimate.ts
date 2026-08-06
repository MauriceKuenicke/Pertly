import { createId } from "./id";
import { DEFAULT_PAYMENT_SPLIT, DEFAULT_ROLES, TM_DEFAULT_PAYMENT_SPLIT } from "./calc";
import { decodeShareCode, encodeToShareCode, isEstimateShape } from "./shareCode";
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
        {
          id: createId(),
          name: "",
          optimisticDays: 1,
          likelyDays: 2,
          pessimisticDays: 4,
          roleId: settings.useRoleBasedPricing ? settings.roles[0]?.id : undefined,
        },
      ],
      useRoleBasedPricing: settings.useRoleBasedPricing,
      roles: settings.roles.map((role) => ({ ...role })),
      paymentSplit: TM_DEFAULT_PAYMENT_SPLIT.map((entry) => ({ ...entry })),
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
 * Backfills fields that didn't exist yet when an estimate was first saved:
 * role-based pricing and payment-split presets both shipped after this
 * app's initial release, so estimates created before then are missing
 * timeMaterials.roles/paymentSplit/useRoleBasedPricing and
 * valueBased.paymentSplit/serviceLines. Every read of an estimate coming
 * from outside this session (loaded from disk, or decoded from a share
 * code) should go through this first so the rest of the app can keep
 * assuming a complete shape.
 */
export function normalizeEstimate(estimate: Estimate): Estimate {
  return {
    ...estimate,
    expenses: estimate.expenses ?? [],
    timeMaterials: {
      workPackages: estimate.timeMaterials?.workPackages ?? [],
      useRoleBasedPricing: estimate.timeMaterials?.useRoleBasedPricing ?? false,
      roles: estimate.timeMaterials?.roles ?? DEFAULT_ROLES.map((role) => ({ ...role })),
      paymentSplit: estimate.timeMaterials?.paymentSplit ?? TM_DEFAULT_PAYMENT_SPLIT.map((entry) => ({ ...entry })),
    },
    valueBased: {
      ...estimate.valueBased,
      serviceLines: estimate.valueBased?.serviceLines ?? [],
      paymentSplit: estimate.valueBased?.paymentSplit ?? DEFAULT_PAYMENT_SPLIT.map((entry) => ({ ...entry })),
    },
  };
}

/**
 * Fresh copy of `source` for the local store: new top-level id and fresh
 * ids for every nested list item (so React keys and the recommended-tier /
 * work-package-role references never collide with the source), reset to a
 * draft at step 1. Shared by cloneEstimate (same-machine duplication) and
 * importEstimateFromShareCode (cross-machine sharing), so an imported
 * estimate never collides with the one it was shared from.
 */
function freshenEstimate(source: Estimate): Estimate {
  const now = new Date().toISOString();
  const tierIdMap = new Map(source.valueBased.tiers.map((tier) => [tier.id, createId()]));
  const roleIdMap = new Map(source.timeMaterials.roles.map((role) => [role.id, createId()]));

  return {
    ...source,
    id: createId(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    assumptions: [...source.assumptions],
    exclusions: [...source.exclusions],
    expenses: source.expenses.map((expense) => ({ ...expense, id: createId() })),
    timeMaterials: {
      workPackages: source.timeMaterials.workPackages.map((pkg) => ({
        ...pkg,
        id: createId(),
        roleId: pkg.roleId ? (roleIdMap.get(pkg.roleId) ?? pkg.roleId) : pkg.roleId,
      })),
      useRoleBasedPricing: source.timeMaterials.useRoleBasedPricing,
      roles: source.timeMaterials.roles.map((role) => ({ ...role, id: roleIdMap.get(role.id)! })),
      paymentSplit: source.timeMaterials.paymentSplit.map((entry) => ({ ...entry })),
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

/**
 * Duplicates an existing estimate as a starting point for a new one: same
 * content, fresh identity (see freshenEstimate), with "(Copy)" appended to
 * the name so it's obviously distinct from the source in the estimates list.
 */
export function cloneEstimate(source: Estimate): Estimate {
  const fresh = freshenEstimate(source);
  return {
    ...fresh,
    projectDetails: {
      ...fresh.projectDetails,
      estimateName: source.projectDetails.estimateName ? `${source.projectDetails.estimateName} (Copy)` : "",
    },
  };
}

/**
 * Encodes an estimate as an opaque, copy-pasteable share code (see
 * shareCode.ts). Works identically for Time & Materials and Value-Based
 * estimates since it just serializes the whole Estimate object.
 */
export function estimateToShareCode(estimate: Estimate): string {
  return encodeToShareCode(estimate);
}

/**
 * Decodes a share code produced by estimateToShareCode back into a fresh,
 * ready-to-use estimate (same identity-freshening as cloneEstimate, but
 * without the "(Copy)" name suffix since this isn't a local duplicate).
 * Throws a user-facing Error if the code is malformed or doesn't look like
 * a Pertly estimate, so callers can show it directly to the user.
 */
export function importEstimateFromShareCode(code: string): Estimate {
  let decoded: unknown;
  try {
    decoded = decodeShareCode(code);
  } catch {
    throw new Error("That code doesn't look right. Double-check you copied the whole thing.");
  }
  if (!isEstimateShape(decoded)) {
    throw new Error("That code doesn't look like a Pertly estimate.");
  }
  return freshenEstimate(normalizeEstimate(decoded));
}
