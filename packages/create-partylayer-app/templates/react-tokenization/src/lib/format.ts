/**
 * Minimal fixed-point decimal helpers for the demo.
 *
 * Amounts are decimal strings END TO END (never JS numbers), matching the
 * CIP-0056 `Decimal` convention where precision must survive. This demo SIMPLIFIES
 * to two decimal places using bigint cents, which is enough for the two-decimal
 * fixtures; a real dApp handling arbitrary-precision decimals should use a decimal
 * library rather than this two-place shortcut. Documented in the README.
 */
const SCALE = 100n;

/** Parse a two-decimal amount string into integer cents (bigint). */
export function toCents(amount: string): bigint {
  const trimmed = amount.trim();
  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ''] = body.split('.');
  const cents = BigInt(whole || '0') * SCALE + BigInt(((frac + '00').slice(0, 2)) || '0');
  return negative ? -cents : cents;
}

/** Render integer cents back to a two-decimal amount string. */
export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  const s = whole.toString() + '.' + frac.toString().padStart(2, '0');
  return negative ? '-' + s : s;
}

export function addAmount(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}

export function subAmount(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b));
}

/** Returns 1 / 0 / -1 for a > b / a === b / a < b. */
export function cmpAmount(a: string, b: string): number {
  const d = toCents(a) - toCents(b);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

/** Group the integer part with thousands separators; keep two decimals. */
export function formatAmount(amount: string): string {
  const [whole, frac = '00'] = amount.split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + '.' + frac.padEnd(2, '0').slice(0, 2);
}

/** Whether an amount is a valid non-negative two-decimal number greater than zero. */
export function isPositiveAmount(amount: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return false;
  return toCents(amount) > 0n;
}
