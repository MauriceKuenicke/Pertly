import { DEFAULT_ROLES } from "./calc";
import type { Settings } from "../types/estimate";

export function defaultSettings(): Settings {
  return {
    dayRate: 900,
    workingHoursPerDay: 8,
    overheadPct: 15,
    contingencyPct: 15,
    currency: "EUR",
    preparerName: "",
    conservativePct: 35,
    attributionPct: 80,
    valueCaptureRatePct: 20,
    useRoleBasedPricing: false,
    roles: DEFAULT_ROLES.map((role) => ({ ...role })),
  };
}
