/**
 * Parse a price string or number. Accepts comma or dot as decimal separator
 * (e.g. "754,69" or "754.69") so European-style input works.
 */
export function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = String(value).trim().replace(/,/g, ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}
