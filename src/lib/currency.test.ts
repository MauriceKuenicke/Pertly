import { describe, expect, it } from "vitest";
import { CURRENCY_CODES, currencySymbol, formatDays, formatMoney } from "./currency";

describe("currencySymbol", () => {
  it("returns known symbols", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("USD")).toBe("$");
  });

  it("falls back to the raw code for unknown currencies", () => {
    expect(currencySymbol("XYZ")).toBe("XYZ ");
  });

  it("exposes a symbol for every currency code, including ones with no dedicated glyph", () => {
    expect(CURRENCY_CODES).toContain("CHF");
    for (const code of CURRENCY_CODES) {
      expect(currencySymbol(code).length).toBeGreaterThan(0);
    }
  });
});

describe("formatMoney", () => {
  it("formats with the currency symbol and thousands separators, no decimals by default", () => {
    expect(formatMoney(1234, "EUR")).toBe("€1,234");
  });

  it("rounds to the requested decimals", () => {
    expect(formatMoney(1234.567, "USD", { decimals: 2 })).toBe("$1,234.57");
  });

  it("rounds -0 to a clean zero rather than printing a negative sign", () => {
    expect(formatMoney(-0.001, "EUR")).toBe("€0");
  });
});

describe("formatDays", () => {
  it("defaults to one decimal place", () => {
    expect(formatDays(2.5)).toBe("2.5");
  });

  it("supports a custom decimal count", () => {
    expect(formatDays(2.567, 2)).toBe("2.57");
  });
});
