/**
 * @partylayer/react: token matching helpers.
 *
 * Framework-free PURE functions (zero React, zero TanStack) for the spec
 * comparisons a settlement venue needs: does a {@link TokenAllocation} satisfy a
 * leg of a {@link TokenAllocationRequest}? Every venue needs exactly this, and the
 * dangerous subtlety is decimal equality: CIP-0056 amounts are decimal-as-string,
 * so a naive `===` wrongly rejects `"5"` versus `"5.00"`. These are the canonical
 * comparators so dApps do not each reinvent (and subtly diverge on) the rules.
 *
 * Only type-only imports from the sibling type modules; nothing here pulls in a
 * runtime dependency, so the module stays importable anywhere.
 */
import type { TokenTransferLeg, TokenSettlementInfo, TokenAllocation } from './token-allocations';
import type { TokenAllocationRequest } from './token-allocation-requests';

const DECIMAL = /^[+-]?\d+(\.\d+)?$/;

/** Normalize a decimal-as-string to a canonical form (caller ensures it matches DECIMAL). */
function normalizeDecimal(value: string): string {
  const s = value.trim();
  const negative = s.startsWith('-');
  const body = s.startsWith('+') || s.startsWith('-') ? s.slice(1) : s;
  const parts = body.split('.');
  const intPart = parts[0].replace(/^0+/, '') || '0';
  const fraction = parts[1] ?? '';
  let end = fraction.length;
  while (end > 0 && fraction.charCodeAt(end - 1) === 48) end--;
  const frac = fraction.slice(0, end);
  const isZero = intPart === '0' && frac === '';
  const sign = negative && !isZero ? '-' : '';
  return sign + intPart + (frac ? '.' + frac : '');
}

/**
 * Decimal-as-string equality WITHOUT float conversion (never `parseFloat`/`Number`,
 * which lose precision on large decimals). When BOTH sides match the decimal pattern
 * `^[+-]?\d+(\.\d+)?$` they are normalized (drop a leading `+`, strip leading zeros
 * on the integer part, strip trailing zeros on the fraction, treat `-0` as `0`) and
 * their canonical forms compared, so `"5"` equals `"5.00"` and `"007"` equals `"7"`.
 * If EITHER side is not a decimal, it falls back to strict string equality.
 */
export function tokenDecimalEquals(a: string, b: string): boolean {
  if (!DECIMAL.test(a.trim()) || !DECIMAL.test(b.trim())) return a === b;
  return normalizeDecimal(a) === normalizeDecimal(b);
}

/** Compare two optional metadata maps: undefined normalized to `{}`, same keys and values. */
function metaEquals(a: Record<string, string> | undefined, b: Record<string, string> | undefined): boolean {
  const ma = a ?? {};
  const mb = b ?? {};
  const ka = Object.keys(ma);
  const kb = Object.keys(mb);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(mb, k) && ma[k] === mb[k]);
}

/**
 * Whether two transfer legs describe the same movement: `sender`, `receiver`, and
 * both `instrumentId` fields by strict equality, `amount` via
 * {@link tokenDecimalEquals} (so formatting differences do not matter), and `meta`
 * with undefined normalized to an empty record.
 */
export function tokenTransferLegEquals(a: TokenTransferLeg, b: TokenTransferLeg): boolean {
  return (
    a.sender === b.sender &&
    a.receiver === b.receiver &&
    a.instrumentId.admin === b.instrumentId.admin &&
    a.instrumentId.id === b.instrumentId.id &&
    tokenDecimalEquals(a.amount, b.amount) &&
    metaEquals(a.meta, b.meta)
  );
}

/**
 * Whether two settlement infos describe the same settlement: `executor`,
 * `settlementRef.id`, `settlementRef.cid` (undefined-safe: both absent or both
 * equal), and the three timestamps by strict string equality; `meta` normalized as
 * above. ISO timestamps are compared verbatim: in wallet flows the allocation spec
 * is composed from the same request object, so verbatim is correct; timezone
 * normalization is deliberately out of scope.
 */
export function tokenSettlementInfoEquals(a: TokenSettlementInfo, b: TokenSettlementInfo): boolean {
  return (
    a.executor === b.executor &&
    a.settlementRef.id === b.settlementRef.id &&
    a.settlementRef.cid === b.settlementRef.cid &&
    a.requestedAt === b.requestedAt &&
    a.allocateBefore === b.allocateBefore &&
    a.settleBefore === b.settleBefore &&
    metaEquals(a.meta, b.meta)
  );
}

/**
 * The venue-side check mirroring the official trading-app's expected-allocation
 * matching: true when the request has the leg, the allocation's spec targets that
 * leg id, its settlement matches the request's settlement (covering the
 * settlementRef tie to the request), and its transfer leg matches the request's leg.
 */
export function allocationMatchesRequestLeg(
  allocation: TokenAllocation,
  request: TokenAllocationRequest,
  legId: string,
): boolean {
  const leg = request.transferLegs[legId];
  if (!leg) return false;
  const spec = allocation.allocation;
  return (
    spec.transferLegId === legId &&
    tokenSettlementInfoEquals(spec.settlement, request.settlement) &&
    tokenTransferLegEquals(spec.transferLeg, leg)
  );
}
