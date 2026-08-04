import { describe, expect, it } from "vitest";
import { formatDate, formatWeeksRange, todayPlusDays } from "./date";

describe("formatDate", () => {
  it("formats as day-month-year, e.g. 04 Aug 2026", () => {
    expect(formatDate(new Date(2026, 7, 4))).toBe("04 Aug 2026");
  });
});

describe("todayPlusDays", () => {
  it("adds the given number of days to today", () => {
    const base = new Date();
    const result = todayPlusDays(14);
    const diffDays = Math.round((result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);
  });

  it("supports negative offsets", () => {
    const base = new Date();
    const result = todayPlusDays(-7);
    const diffDays = Math.round((result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(-7);
  });
});

describe("formatWeeksRange", () => {
  it("formats a range as min–max weeks", () => {
    expect(formatWeeksRange(3, 4)).toBe("3–4 weeks");
  });

  it("collapses to a single value when min equals max", () => {
    expect(formatWeeksRange(2, 2)).toBe("2 weeks");
  });

  it("uses singular \"week\" for exactly one week", () => {
    expect(formatWeeksRange(1, 1)).toBe("1 week");
  });
});
