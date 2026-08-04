import type { ExpenseItem, OverheadRisk, PaymentSplitEntry, RateEffort, ValueBasedData, WorkPackage } from "../types/estimate";

// --- Time & Materials: three-point (PERT) estimation ---------------------
//
// Expected = (Optimistic + 4 x Likely + Pessimistic) / 6
// Sigma     = (Pessimistic - Optimistic) / 6
// Row cost is billed at the base day rate; overhead and contingency are
// layered on top of the total, not per row.

export interface WorkPackageCalc extends WorkPackage {
  expectedDays: number;
  sigmaDays: number;
  cost: number;
}

/**
 * Enforces optimistic ≤ likely ≤ pessimistic (and days ≥ 0) by pushing later
 * bounds up to meet earlier ones. Without this, a pessimistic case entered
 * lower than the optimistic one produces a negative σ, which reads as
 * negative risk in the summary and proposal.
 */
export function normalizeWorkPackageDays(pkg: WorkPackage): WorkPackage {
  const optimisticDays = Math.max(0, pkg.optimisticDays);
  const likelyDays = Math.max(optimisticDays, pkg.likelyDays);
  const pessimisticDays = Math.max(likelyDays, pkg.pessimisticDays);
  return { ...pkg, optimisticDays, likelyDays, pessimisticDays };
}

export function calcWorkPackage(pkg: WorkPackage, dayRate: number): WorkPackageCalc {
  const normalized = normalizeWorkPackageDays(pkg);
  const expectedDays = (normalized.optimisticDays + 4 * normalized.likelyDays + normalized.pessimisticDays) / 6;
  const sigmaDays = (normalized.pessimisticDays - normalized.optimisticDays) / 6;
  return { ...normalized, expectedDays, sigmaDays, cost: expectedDays * dayRate };
}

export interface TimeMaterialsTotals {
  rows: WorkPackageCalc[];
  totalOptimisticDays: number;
  totalLikelyDays: number;
  totalPessimisticDays: number;
  expectedDays: number;
  sigmaDays: number; // combined via root-sum-of-squares
  baseCost: number;
  effectiveDayRate: number;
  overheadAmount: number;
  deliverySubtotal: number;
  contingencyAmount: number;
  recommendedBudget: number;
  pessimisticCost: number;
  notToExceedCap: number;
}

export function calcTimeMaterials(
  workPackages: WorkPackage[],
  rateEffort: RateEffort,
  overheadRisk: OverheadRisk,
): TimeMaterialsTotals {
  const rows = workPackages.map((pkg) => calcWorkPackage(pkg, rateEffort.dayRate));

  const totalOptimisticDays = sum(rows.map((r) => r.optimisticDays));
  const totalLikelyDays = sum(rows.map((r) => r.likelyDays));
  const totalPessimisticDays = sum(rows.map((r) => r.pessimisticDays));
  const expectedDays = sum(rows.map((r) => r.expectedDays));
  const sigmaDays = Math.sqrt(sum(rows.map((r) => r.sigmaDays ** 2)));
  const baseCost = sum(rows.map((r) => r.cost));

  const overheadPct = overheadRisk.overheadPct / 100;
  const contingencyPct = overheadRisk.contingencyPct / 100;

  const effectiveDayRate = rateEffort.dayRate * (1 + overheadPct);
  const overheadAmount = baseCost * overheadPct;
  const deliverySubtotal = baseCost + overheadAmount;
  const contingencyAmount = deliverySubtotal * contingencyPct;
  const recommendedBudget = deliverySubtotal + contingencyAmount;

  const pessimisticCost = totalPessimisticDays * rateEffort.dayRate;
  const notToExceedCap = pessimisticCost * (1 + overheadPct);

  return {
    rows,
    totalOptimisticDays,
    totalLikelyDays,
    totalPessimisticDays,
    expectedDays,
    sigmaDays,
    baseCost,
    effectiveDayRate,
    overheadAmount,
    deliverySubtotal,
    contingencyAmount,
    recommendedBudget,
    pessimisticCost,
    notToExceedCap,
  };
}

/** Distributes the recommended budget across work packages, proportional to base cost. */
export function allocateBudgetByPackage(totals: TimeMaterialsTotals): { id: string; name: string; amount: number }[] {
  if (totals.baseCost === 0) return totals.rows.map((r) => ({ id: r.id, name: r.name, amount: 0 }));
  return totals.rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: (r.cost / totals.baseCost) * totals.recommendedBudget,
  }));
}

// --- Value-based pricing ---------------------------------------------------
//
// Annual problem cost = sum of value drivers.
// Conservative / moderate / aggressive scenarios scale off the conservative
// improvement percentage the user sets (moderate = 1.5x, aggressive = 2x),
// clamped to 100%.
// Fee = conservative value x attribution x value capture rate.

export interface ValueBasedTotals {
  annualProblemCost: number;
  conservativePct: number;
  moderatePct: number;
  aggressivePct: number;
  conservativeValue: number;
  moderateValue: number;
  aggressiveValue: number;
  attributionValue: number;
  recommendedFee: number;
  clientRoi: number;
}

export function calcValueBased(data: ValueBasedData): ValueBasedTotals {
  const annualProblemCost = sum(data.valueDrivers.map((d) => d.annualAmount));

  const conservativePct = data.conservativePct;
  const moderatePct = Math.min(conservativePct * 1.5, 100);
  const aggressivePct = Math.min(conservativePct * 2, 100);

  const conservativeValue = annualProblemCost * (conservativePct / 100);
  const moderateValue = annualProblemCost * (moderatePct / 100);
  const aggressiveValue = annualProblemCost * (aggressivePct / 100);

  const attributionValue = conservativeValue * (data.attributionPct / 100);
  const recommendedFee = attributionValue * (data.valueCaptureRatePct / 100);
  const clientRoi = recommendedFee > 0 ? conservativeValue / recommendedFee : 0;

  return {
    annualProblemCost,
    conservativePct,
    moderatePct,
    aggressivePct,
    conservativeValue,
    moderateValue,
    aggressiveValue,
    attributionValue,
    recommendedFee,
    clientRoi,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

// --- Pass-through expenses --------------------------------------------------
//
// Hardware, licenses, travel and similar costs billed at cost, on top of the
// professional fee. Kept separate from calcTimeMaterials/calcValueBased since
// overhead and contingency are markup on labor and shouldn't apply to them.

export function sumExpenses(expenses: ExpenseItem[]): number {
  return sum(expenses.map((e) => e.amount));
}

// --- Payment milestones -----------------------------------------------------
//
// A suggested payment schedule for whatever the client is quoted (labor plus
// pass-through expenses). Time & Materials always uses the Standard preset;
// Value-Based Pricing estimates can pick a different preset per estimate
// (see ValueBasedData.paymentSplit).

export interface PaymentMilestone {
  label: string;
  pct: number;
  amount: number;
}

export interface PaymentSplitPreset {
  id: string;
  name: string;
  description: string;
  entries: PaymentSplitEntry[];
}

export const PAYMENT_SPLIT_PRESETS: PaymentSplitPreset[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Works for most 4–12 week engagements with one clear midpoint milestone.",
    entries: [
      { label: "Deposit (on signing)", pct: 30 },
      { label: "Midpoint milestone", pct: 40 },
      { label: "Final payment (on delivery)", pct: 30 },
    ],
  },
  {
    id: "deposit-delivery",
    name: "Deposit & Delivery",
    description: "A simple two-part split for short engagements (under a month) or established clients.",
    entries: [
      { label: "Deposit (on signing)", pct: 50 },
      { label: "Final payment (on delivery)", pct: 50 },
    ],
  },
  {
    id: "upfront",
    name: "Full Upfront",
    description: "Zero collection risk. Best for small, low-cost work or trusted repeat clients.",
    entries: [{ label: "Full payment (on signing)", pct: 100 }],
  },
  {
    id: "quarterly",
    name: "Quarterly",
    description: "Four even installments for longer, multi-phase engagements (3+ months).",
    entries: [
      { label: "Payment 1 (on signing)", pct: 25 },
      { label: "Payment 2", pct: 25 },
      { label: "Payment 3", pct: 25 },
      { label: "Payment 4 (on delivery)", pct: 25 },
    ],
  },
];

export const DEFAULT_PAYMENT_SPLIT: PaymentSplitEntry[] = PAYMENT_SPLIT_PRESETS[0].entries;

/**
 * Finds which preset (if any) the given split exactly matches, so the UI can
 * highlight it. A missing or empty split (e.g. an estimate saved before this
 * field existed) falls back to "standard", since that's what every new
 * estimate is seeded with.
 */
export function matchingPaymentSplitPresetId(split: PaymentSplitEntry[] | undefined): string | null {
  if (!split || split.length === 0) return PAYMENT_SPLIT_PRESETS[0].id;
  const preset = PAYMENT_SPLIT_PRESETS.find(
    (p) =>
      p.entries.length === split.length &&
      p.entries.every((entry, i) => entry.label === split[i]?.label && entry.pct === split[i]?.pct),
  );
  return preset?.id ?? null;
}

/**
 * Clamps a payment split so it always sums to exactly 100%: entries are
 * capped in order by whatever's left of the budget, and the last entry
 * absorbs the remainder. This makes an over-100% split structurally
 * impossible instead of just flagging one after the fact.
 */
export function normalizePaymentSplit(split: PaymentSplitEntry[]): PaymentSplitEntry[] {
  let remaining = 100;
  return split.map((entry, i) => {
    if (i === split.length - 1) return { ...entry, pct: remaining };
    const pct = Math.max(0, Math.min(entry.pct, remaining));
    remaining -= pct;
    return { ...entry, pct };
  });
}

export function calcPaymentMilestones(
  totalAmount: number,
  split: PaymentSplitEntry[] = DEFAULT_PAYMENT_SPLIT,
): PaymentMilestone[] {
  const effectiveSplit = split.length > 0 ? split : DEFAULT_PAYMENT_SPLIT;
  return normalizePaymentSplit(effectiveSplit).map((m) => ({ ...m, amount: totalAmount * (m.pct / 100) }));
}
