import type {
  ExpenseItem,
  OverheadRisk,
  PaymentSplitEntry,
  RateEffort,
  Role,
  TimeMaterialsData,
  ValueBasedData,
  WorkPackage,
} from "../types/estimate";

// --- Time & Materials: three-point (PERT) estimation ---------------------
//
// Expected = (Optimistic + 4 x Likely + Pessimistic) / 6
// Sigma     = (Pessimistic - Optimistic) / 6
// Row cost is billed at the base day rate; overhead and contingency are
// layered on top of the total, not per row.

export interface WorkPackageCalc extends WorkPackage {
  dayRate: number;
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
  return { ...normalized, dayRate, expectedDays, sigmaDays, cost: expectedDays * dayRate };
}

// --- Role-based rates --------------------------------------------------------
//
// A T&M estimate can either bill every work package at one blended day rate
// (RateEffort.dayRate) or assign each package to a role with its own day
// rate. The roster lives per-estimate (seeded from Settings.roles) so past
// estimates aren't disturbed if default rates change later.

export const DEFAULT_ROLES: Role[] = [
  { id: "trainee", name: "Trainee", dayRate: 0 },
  { id: "junior", name: "Junior", dayRate: 75 },
  { id: "midlevel", name: "Mid-level", dayRate: 95 },
  { id: "senior", name: "Senior", dayRate: 110 },
  { id: "principal", name: "Principal", dayRate: 150 },
];

/**
 * Resolves the day rate for a single work package: the assigned role's rate
 * in role-based mode, or the blended rate otherwise. Falls back to the
 * blended rate if the package has no role assigned, or references a role
 * that's since been removed from the roster, so a row is never silently
 * priced at zero.
 */
export function resolveWorkPackageDayRate(pkg: WorkPackage, tm: TimeMaterialsData, blendedDayRate: number): number {
  if (!tm.useRoleBasedPricing) return blendedDayRate;
  const role = tm.roles?.find((r) => r.id === pkg.roleId);
  return role ? role.dayRate : blendedDayRate;
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
  timeMaterials: TimeMaterialsData,
  rateEffort: RateEffort,
  overheadRisk: OverheadRisk,
): TimeMaterialsTotals {
  const rows = timeMaterials.workPackages.map((pkg) =>
    calcWorkPackage(pkg, resolveWorkPackageDayRate(pkg, timeMaterials, rateEffort.dayRate)),
  );

  const totalOptimisticDays = sum(rows.map((r) => r.optimisticDays));
  const totalLikelyDays = sum(rows.map((r) => r.likelyDays));
  const totalPessimisticDays = sum(rows.map((r) => r.pessimisticDays));
  const expectedDays = sum(rows.map((r) => r.expectedDays));
  const sigmaDays = Math.sqrt(sum(rows.map((r) => r.sigmaDays ** 2)));
  const baseCost = sum(rows.map((r) => r.cost));

  const overheadPct = overheadRisk.overheadPct / 100;
  const contingencyPct = overheadRisk.contingencyPct / 100;

  // Blended average of whatever rates actually got used, so this stays
  // meaningful in role-based mode instead of just echoing the fallback rate.
  const effectiveDayRate = (expectedDays > 0 ? baseCost / expectedDays : rateEffort.dayRate) * (1 + overheadPct);
  const overheadAmount = baseCost * overheadPct;
  const deliverySubtotal = baseCost + overheadAmount;
  const contingencyAmount = deliverySubtotal * contingencyPct;
  const recommendedBudget = deliverySubtotal + contingencyAmount;

  // Marked up the same way as the recommended budget (overhead, then
  // contingency compounded on top) so the cap can never fall below the
  // number you're quoting: pessimisticDays >= expectedDays per row (PERT
  // normalization guarantees O <= L <= P), so pessimisticCost >= baseCost,
  // and the same two markups applied to a larger base can only stay >= it.
  const pessimisticCost = sum(rows.map((r) => r.pessimisticDays * r.dayRate));
  const notToExceedCap = pessimisticCost * (1 + overheadPct) * (1 + contingencyPct);

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

export interface RoleBreakdownRow {
  roleId: string;
  roleName: string;
  dayRate: number;
  days: number;
  cost: number;
  pctOfCost: number;
}

/**
 * Groups base cost by role for display in the summary/internal views. Empty
 * outside role-based mode. Roles with no work package assigned to them are
 * omitted so the breakdown only shows the roster actually in use; packages
 * left unassigned (or pointing at a since-deleted role) are grouped under a
 * trailing "Unassigned" row so the fallback-to-blended-rate case stays
 * visible instead of silently disappearing into another role's total.
 */
export function calcRoleBreakdown(timeMaterials: TimeMaterialsData, rateEffort: RateEffort): RoleBreakdownRow[] {
  if (!timeMaterials.useRoleBasedPricing) return [];

  const totals = new Map<string, { roleName: string; dayRate: number; days: number; cost: number }>();
  for (const pkg of timeMaterials.workPackages) {
    const role = timeMaterials.roles?.find((r) => r.id === pkg.roleId);
    const dayRate = role ? role.dayRate : rateEffort.dayRate;
    const row = calcWorkPackage(pkg, dayRate);
    const key = role ? role.id : "unassigned";
    const existing = totals.get(key);
    if (existing) {
      existing.days += row.expectedDays;
      existing.cost += row.cost;
    } else {
      totals.set(key, { roleName: role ? role.name : "Unassigned", dayRate, days: row.expectedDays, cost: row.cost });
    }
  }

  const totalCost = sum([...totals.values()].map((r) => r.cost));
  const orderedKeys = [...(timeMaterials.roles ?? []).map((r) => r.id), "unassigned"];
  return orderedKeys
    .filter((key) => totals.has(key))
    .map((key) => {
      const row = totals.get(key)!;
      return {
        roleId: key,
        roleName: row.roleName,
        dayRate: row.dayRate,
        days: row.days,
        cost: row.cost,
        pctOfCost: totalCost > 0 ? (row.cost / totalCost) * 100 : 0,
      };
    });
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

export interface BreakEvenEffort {
  effectiveDayRate: number;
  breakEvenDays: number;
}

/**
 * How many days of delivery effort the recommended fee "buys" at the
 * freelancer's normal effective day rate (day rate marked up by overhead).
 * A rough internal profitability check for value-based pricing: spend more
 * than this on delivery and you're effectively earning less than your
 * normal day rate. Never shown to the client, since it reasons about cost
 * basis the value-based pitch deliberately doesn't lead with.
 */
export function calcBreakEvenEffort(
  recommendedFee: number,
  rateEffort: RateEffort,
  overheadRisk: OverheadRisk,
): BreakEvenEffort {
  const effectiveDayRate = rateEffort.dayRate * (1 + overheadRisk.overheadPct / 100);
  return {
    effectiveDayRate,
    breakEvenDays: effectiveDayRate > 0 ? recommendedFee / effectiveDayRate : 0,
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
// pass-through expenses). Value-Based and Time & Materials estimates each
// pick from their own preset list, since a fixed-fee deliverable and ongoing
// hourly billing call for different milestone shapes (see
// ValueBasedData.paymentSplit / TimeMaterialsData.paymentSplit).

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

// Time & Materials bills for actual time worked, so a fixed-fee-style
// deposit/milestone structure doesn't fit as naturally as it does for VBP.
// These lean toward ongoing, usage-based billing instead, with "monthly in
// arrears" (pure pay-as-you-go, no deposit) as the T&M-idiomatic default.
export const TM_PAYMENT_SPLIT_PRESETS: PaymentSplitPreset[] = [
  {
    id: "monthly-arrears",
    name: "Monthly in Arrears",
    description: "The T&M default: invoice monthly for actual hours worked. No deposit, no over- or under-billing.",
    entries: [{ label: "Billed monthly in arrears (actuals)", pct: 100 }],
  },
  {
    id: "deposit-monthly",
    name: "Deposit & Monthly",
    description: "A deposit for commitment and cash flow, then invoice monthly in arrears for the rest as work happens.",
    entries: [
      { label: "Deposit (on signing)", pct: 20 },
      { label: "Remaining balance, billed monthly in arrears", pct: 80 },
    ],
  },
  {
    id: "deposit-final",
    name: "Deposit & Final",
    description: "A simple two-part split: deposit on signing, balance when the engagement completes.",
    entries: [
      { label: "Deposit (on signing)", pct: 50 },
      { label: "Final payment (on completion)", pct: 50 },
    ],
  },
  {
    id: "full-completion",
    name: "Full at Completion",
    description: "One invoice once the engagement wraps up. Best for short, well-scoped work with a trusted client.",
    entries: [{ label: "Full payment (on completion)", pct: 100 }],
  },
];

export const TM_DEFAULT_PAYMENT_SPLIT: PaymentSplitEntry[] = TM_PAYMENT_SPLIT_PRESETS[0].entries;

/**
 * Finds which preset (if any) the given split exactly matches, so the UI can
 * highlight it. A missing or empty split (e.g. an estimate saved before this
 * field existed) falls back to the first preset in the list, since that's
 * what every new estimate is seeded with. Pass TM_PAYMENT_SPLIT_PRESETS for
 * a Time & Materials estimate; defaults to the Value-Based preset list.
 */
export function matchingPaymentSplitPresetId(
  split: PaymentSplitEntry[] | undefined,
  presets: PaymentSplitPreset[] = PAYMENT_SPLIT_PRESETS,
): string | null {
  if (!split || split.length === 0) return presets[0]?.id ?? null;
  const preset = presets.find(
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
