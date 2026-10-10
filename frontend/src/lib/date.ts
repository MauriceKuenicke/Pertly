export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayPlusDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function formatWeeksRange(minWeeks: number, maxWeeks: number): string {
  if (minWeeks === maxWeeks) return `${minWeeks} week${minWeeks === 1 ? "" : "s"}`;
  return `${minWeeks}–${maxWeeks} weeks`;
}
