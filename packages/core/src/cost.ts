/**
 * Traffic-cost types for the cost-visibility UX layer.
 *
 * These are a lightweight, standard representation of the cost fields the Canton
 * JSON Ledger API already exposes (Canton 3.5.5). PartyLayer does NOT own ledger
 * transport — the dApp supplies its own cost-fetcher against its validator; this
 * module only provides the shared types + pure helpers so `@partylayer/react` and
 * (later) `@partylayer/vue` can build cost hooks/UI on a common foundation.
 *
 * Field names below mirror the node's OpenAPI schema verbatim:
 *   - estimate (pre-execution):   `CostEstimation` (under
 *     `JsPrepareSubmissionResponse.costEstimation`, optional on the response)
 *   - actual (post-execution):    `paidTrafficCost` (on the completion —
 *     authoritative for command-driven flows — and on the transaction)
 *
 * All cost values are int64 on the wire and can exceed `Number.MAX_SAFE_INTEGER`,
 * so they are represented as a 64-bit-safe decimal string ({@link TrafficCost})
 * rather than a JS `number`. Use {@link trafficCostToBigInt} for arithmetic.
 */

/**
 * A non-negative int64 traffic-cost amount, stored as a canonical decimal string
 * to survive values beyond `Number.MAX_SAFE_INTEGER` without precision loss.
 *
 * Branded (following the convention in `types.ts`, e.g. `TransactionHash`) so a
 * raw `string` cannot be passed where a validated cost is expected. Construct via
 * {@link toTrafficCost}; convert for arithmetic via {@link trafficCostToBigInt}.
 */
export type TrafficCost = string & { readonly __brand: 'TrafficCost' };

/**
 * Pre-execution traffic-cost estimate for a prepared transaction.
 *
 * Mirrors the node's `CostEstimation` schema (nested under
 * `JsPrepareSubmissionResponse.costEstimation`, which is itself optional). The
 * three cost fields are int64-as-string ({@link TrafficCost}).
 */
export interface CostEstimation {
  /**
   * Timestamp (as returned by the node) at which the estimation was made.
   * Required by the node schema. Kept as the raw string the API provides.
   */
  estimationTimestamp: string;

  /**
   * Estimated traffic cost of the confirmation request associated with the
   * transaction (the cost the submitting node expects to pay). int64-as-string.
   */
  confirmationRequestTrafficCostEstimation: TrafficCost;

  /**
   * Estimated traffic cost of the confirmation response associated with the
   * transaction — also an indication of what other confirming nodes of the party
   * will incur to approve/reject it. int64-as-string.
   */
  confirmationResponseTrafficCostEstimation: TrafficCost;

  /**
   * Sum of {@link confirmationRequestTrafficCostEstimation} and
   * {@link confirmationResponseTrafficCostEstimation}. int64-as-string.
   */
  totalTrafficCostEstimation: TrafficCost;
}

/**
 * Post-execution ACTUAL traffic cost paid by the participant, an int64-as-string
 * ({@link TrafficCost}).
 *
 * On the wire this is the optional `paidTrafficCost` field; for command-driven
 * flows the authoritative source is the completion's `paidTrafficCost`, mirrored
 * on the resulting transaction. It is optional (may be absent — e.g. for updates
 * initiated by another participant, or processed before the node served traffic
 * cost on the Ledger API), so model it as `PaidTrafficCost | undefined` at call sites.
 */
export type PaidTrafficCost = TrafficCost;

/**
 * Validate and brand a traffic-cost value as a {@link TrafficCost}.
 *
 * Accepts a decimal `string` (recommended for full int64 range), a `number`
 * (must be a safe integer — pass large int64 values as a string/bigint to avoid
 * precision loss), or a `bigint`. The result is the canonical decimal string.
 *
 * @throws {TypeError} if the value is not a non-negative integer (non-integer,
 *   NaN, empty, or a malformed string).
 * @throws {RangeError} if the value is negative, or a `number` beyond
 *   `Number.MAX_SAFE_INTEGER` (which cannot represent int64 precisely).
 */
export function toTrafficCost(value: string | number | bigint): TrafficCost {
  let big: bigint;

  if (typeof value === 'bigint') {
    big = value;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError(
        `Invalid traffic cost: expected a non-negative integer, got number ${value}`,
      );
    }
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(
        `Traffic cost number ${value} exceeds Number.MAX_SAFE_INTEGER; pass int64 values as a string or bigint to avoid precision loss`,
      );
    }
    big = BigInt(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      throw new TypeError(
        `Invalid traffic cost: expected a non-negative integer string, got "${value}"`,
      );
    }
    big = BigInt(trimmed);
  } else {
    throw new TypeError(`Invalid traffic cost: unsupported type ${typeof value}`);
  }

  if (big < 0n) {
    throw new RangeError(`Invalid traffic cost: must be non-negative, got ${big.toString()}`);
  }

  // Canonical decimal string (e.g. strips a leading "+0" / "007" -> "7").
  return big.toString() as TrafficCost;
}

/**
 * Convert a {@link TrafficCost} to a `bigint` for precision-safe arithmetic.
 * The branded string is always a canonical non-negative decimal integer, so this
 * is lossless for the full int64 range.
 */
export function trafficCostToBigInt(cost: TrafficCost): bigint {
  return BigInt(cost);
}
