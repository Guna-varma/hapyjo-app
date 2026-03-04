/**
 * Currency: Rwandan Franc (RWF). Symbol FRw used for display per local convention.
 * Single source for symbol and formatting across the app.
 */
export const CURRENCY_CODE = 'RWF';
export const CURRENCY_SYMBOL = 'FRw';

/** Format amount in RWF: "1,234,567" or "1.2M" for millions when compact. Safe for undefined/null. */
export function formatCurrency(amount: number | undefined | null, compact = false): string {
  const n = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  if (compact && n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return n.toLocaleString();
}

/** Full formatted amount with symbol, e.g. "RWF 1,234,567" or "RWF 1.2M". Safe for undefined/null. */
export function formatAmount(amount: number | undefined | null, compact = false): string {
  return `${CURRENCY_SYMBOL} ${formatCurrency(amount, compact)}`;
}

/** Per-unit label, e.g. "RWF/L" for cost per litre. */
export function formatPerUnit(unit: string): string {
  return `${CURRENCY_SYMBOL}/${unit}`;
}
