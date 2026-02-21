/**
 * Currency: RWF (Rwandan Franc) per PRD.
 * Single source for symbol and formatting across the app.
 */
export const CURRENCY_CODE = 'RWF';
export const CURRENCY_SYMBOL = 'RWF';

/** Format amount in RWF: "1,234,567" or "1.2M" for millions when compact. */
export function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return amount.toLocaleString();
}

/** Full formatted amount with symbol, e.g. "RWF 1,234,567" or "RWF 1.2M". */
export function formatAmount(amount: number, compact = false): string {
  return `${CURRENCY_SYMBOL} ${formatCurrency(amount, compact)}`;
}

/** Per-unit label, e.g. "RWF/L" for cost per litre. */
export function formatPerUnit(unit: string): string {
  return `${CURRENCY_SYMBOL}/${unit}`;
}
