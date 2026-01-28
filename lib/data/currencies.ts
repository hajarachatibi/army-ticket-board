/** Currency options for tickets (code, label, symbol). */
export const CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "KRW", label: "Korean Won", symbol: "₩" },
] as const;

const SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  CURRENCY_OPTIONS.map((c) => [c.code, c.symbol])
);

/**
 * Format price with currency. Uses symbol when available (e.g. $150), else "150 USD".
 */
export function formatPrice(price: number, currency: string): string {
  const sym = SYMBOL_MAP[currency];
  if (sym) return `${sym}${price}`;
  return `${price} ${currency}`;
}
