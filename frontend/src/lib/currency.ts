const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF ",
};

export const CURRENCY_CODES = Object.keys(SYMBOLS);

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? `${code} `;
}

export function formatMoney(amount: number, currency: string, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  const rounded = Math.round(amount * 10 ** decimals) / 10 ** decimals;
  const formatted = (rounded === 0 ? 0 : rounded).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currencySymbol(currency)}${formatted}`;
}

/** A deduction, e.g. a discount line: "−€1,150" (typographic minus). */
export function formatDeduction(amount: number, currency: string): string {
  return `−${formatMoney(Math.abs(amount), currency)}`;
}

export function formatDays(days: number, decimals = 2): string {
  return days.toFixed(decimals);
}
