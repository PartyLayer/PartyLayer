import type { TokenInstrumentId } from './transfer';

/**
 * A CIP-0056 holding lock. Mirrors `Lock` from `Splice.Api.Token.HoldingV1`.
 * Present when the holding is locked; absent (`undefined`) when it is free.
 */
export interface TokenLock {
  /** The parties holding the lock (Daml `[Party]`). */
  holders: string[];
  /** Absolute expiry, an ISO 8601 timestamp (Daml `Optional Time`). */
  expiresAt?: string;
  /**
   * Relative expiry (Daml `Optional RelTime`). Daml has no native TS RelTime
   * type in this codebase, so it is represented as a string (the raw value the
   * dApp's ledger JSON provides).
   */
  expiresAfter?: string;
  /** Optional lock context label (Daml `Optional Text`). */
  context?: string;
}

/**
 * A CIP-0056 token holding. Mirrors `HoldingView` from
 * `Splice.Api.Token.HoldingV1` (Canton Token Standard, Splice, Apache-2.0,
 * Digital Asset). A dApp reading raw ledger JSON maps each holding contract's
 * interface view into this shape.
 */
export interface TokenHolding {
  /** The party that owns the holding (Daml `Party`). */
  owner: string;
  /** The instrument this holding is denominated in. */
  instrumentId: TokenInstrumentId;
  /**
   * The held amount, a decimal-as-string to preserve exact precision (Daml
   * `Decimal`). NEVER a JS `number`, which cannot represent large or precise
   * decimals losslessly.
   */
  amount: string;
  /** The lock, when the holding is locked; `undefined` when it is free. */
  lock?: TokenLock;
  /** Free-form metadata, a string-to-string map (Daml `Metadata`, a `TextMap Text`). */
  meta?: Record<string, string>;
}

/**
 * A holding as an ACS query returns it: a contract id paired with its interface
 * view. The unit a dApp reads is `{ cid, view }`, not the view alone: the `cid` is
 * what feeds {@link TokenTransfer.inputHoldingCids} and
 * `AllocationInstructionRequest.inputHoldingCids`, while `holding` stays a
 * byte-exact `HoldingView` mirror (the standard view carries no contract id).
 */
export interface TokenHoldingRef {
  /** The holding contract's id (Daml `ContractId Holding`). */
  cid: string;
  /** The standard holding view. */
  holding: TokenHolding;
}
