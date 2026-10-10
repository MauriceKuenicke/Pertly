export type PricingMethod = "value-based" | "time-materials";

export type EstimateStatus = "draft" | "done";

export type WizardStep = 1 | 2 | 3 | 4;

export interface ProjectDetails {
  estimateName: string;
  clientName: string;
  currency: string; // ISO 4217 code, e.g. "EUR"
  preparerName: string; // shown as "prepared by" on the proposal document
}

export interface RateEffort {
  dayRate: number;
  workingHoursPerDay: number;
}

export interface OverheadRisk {
  overheadPct: number; // 0-100
  contingencyPct: number; // 0-100
}

export interface WorkPackage {
  id: string;
  name: string;
  optimisticDays: number;
  likelyDays: number;
  pessimisticDays: number;
  roleId?: string; // which role this package bills at; only used when useRoleBasedPricing is true
}

export interface Role {
  id: string;
  name: string;
  dayRate: number;
}

export interface ValueDriver {
  id: string;
  label: string;
  hint: string;
  annualAmount: number;
}

export interface PricingTier {
  id: string;
  name: string;
  durationMinWeeks: number;
  durationMaxWeeks: number;
  price: number;
  description: string;
}

export interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
}

export interface PaymentSplitEntry {
  label: string;
  pct: number; // 0-100, share of the total quoted price
}

export interface TimeMaterialsData {
  workPackages: WorkPackage[];
  useRoleBasedPricing: boolean;
  roles: Role[];
  paymentSplit: PaymentSplitEntry[]; // suggested payment schedule, editable
  isFixedPrice: boolean; // false = variable/actuals billing, true = single fixed price quoted upfront
  // 0-100, slider. Only meaningful when isFixedPrice is true: how much of the
  // optimistic-pessimistic spread gets priced into the fixed quote, from the
  // expected case (0) to the full pessimistic case (100). See calcTimeMaterials.
  fixedPriceRiskCoveragePct: number;
}

export interface ValueBasedData {
  valueDrivers: ValueDriver[];
  conservativePct: number; // 5-80, slider
  attributionPct: number; // 10-100, slider
  valueCaptureRatePct: number; // 5-25, slider
  tiers: PricingTier[]; // exactly 3: A, B (recommended), C
  recommendedTierId: string;
  paymentSplit: PaymentSplitEntry[]; // suggested payment schedule, editable
}

export interface Estimate {
  id: string;
  status: EstimateStatus;
  createdAt: string;
  updatedAt: string;
  currentStep: WizardStep;
  // The furthest step ever reached, independent of currentStep. Lets the
  // breadcrumb keep steps clickable after navigating back to fix something,
  // instead of re-gating on how far the user has already gotten.
  furthestStep: WizardStep;
  pricingMethod: PricingMethod;
  projectDetails: ProjectDetails;
  rateEffort: RateEffort;
  overheadRisk: OverheadRisk;
  assumptions: string[];
  exclusions: string[];
  expenses: ExpenseItem[];
  timeMaterials: TimeMaterialsData;
  valueBased: ValueBasedData;
}

/** Reusable defaults applied whenever a new estimate is created (Settings screen). */
export interface Settings {
  dayRate: number;
  workingHoursPerDay: number;
  overheadPct: number;
  contingencyPct: number;
  currency: string;
  preparerName: string;
  conservativePct: number;
  attributionPct: number;
  valueCaptureRatePct: number;
  useRoleBasedPricing: boolean; // default for new Time & Materials estimates
  roles: Role[]; // default roster copied into new estimates
}

export interface Store {
  estimates: Estimate[];
  settings: Settings;
}
