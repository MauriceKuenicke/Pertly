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
}

export interface ValueBasedData {
  valueDrivers: ValueDriver[];
  conservativePct: number; // 5-80, slider
  attributionPct: number; // 10-100, slider
  valueCaptureRatePct: number; // 5-25, slider
  serviceLines: string[];
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
}

export interface Store {
  estimates: Estimate[];
  settings: Settings;
}
