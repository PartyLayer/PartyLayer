/**
 * Typed transfer intent — the wallet-owned write path.
 *
 * An application says what it wants transferred. The wallet does everything
 * else: it builds the command from the intent using its own view of what a
 * transfer means, prepares it against the validator it is connected to, decodes
 * and displays it, obtains the user's approval, signs, executes, and reports the
 * real update id back.
 *
 * The application never holds the prepared transaction, never sees the hash
 * before the user does, and cannot substitute anything between the display and
 * the signature.
 *
 * WHY THIS IS NOT `ledgerApi`. `ledgerApi()` is a generic proxy with a free-form
 * resource path. Pointed at the interactive-submission endpoints it becomes a
 * request to sign arbitrary bytes: the wallet cannot decode what was asked for,
 * so it cannot render a meaningful confirmation, so the user approves a hash.
 * Ethereum removed exactly this capability twice — MetaMask deleted `eth_sign`
 * on 1 August 2024, and Safe removed it from its interface on 24 February 2025,
 * three days after the Bybit incident in which the approvals recorded were
 * signatures whose contents the signer could not read. A wallet's core job is to
 * be the place where a human sees what they are agreeing to; an interface that
 * makes that impossible removes the wallet's reason to exist. `ledgerApi` is
 * left exactly as it is, and this method sits alongside it.
 *
 * WHY THE FIELDS ARE THESE FIELDS. The shape is not invented. It is the
 * intersection of what the CIP-0056 Canton Token Standard `Transfer` record
 * carries and what three independent wallet SDKs already accept: Console's
 * `SignSendRequest` (`to` / `token` / `amount` / `memo`), Nightly's
 * `CreateTransferCommandParams` (`receiverPartyId` / `instrument` / `amount` /
 * `memo`), and Loop's `transfer(recipient, amount, instrument, options)`. Where
 * those three agree, this type agrees with them.
 */

import type { PartyId } from './types';
import { TransportError } from './errors';

/**
 * A CIP-0056 instrument identifier: the instrument and the party that issues it.
 *
 * Structurally identical to `TokenInstrumentId` in `@partylayer/react`'s holdings
 * hook (and to Nightly's `Instrument { id, admin }` and Loop's
 * `{ instrument_id, instrument_admin }`), so a value read from `useTokenHoldings`
 * can be passed straight into a {@link TransferIntent} with no conversion.
 *
 * `admin` is the issuer. It is carried separately from `id` because a wallet
 * confirmation that names an instrument without naming who issues it is not
 * telling the user enough to decide: two instruments can share a symbol.
 */
export interface TokenInstrumentId {
  /** The registry app party administering the instrument (Daml `Party`). */
  admin: string;
  /** The instrument identifier, unique per `admin` (Daml `Text`). */
  id: string;
}

/**
 * What the application asks for. It does not pass a path, a command, or a
 * prepared transaction.
 *
 * NOTE WHAT IS ABSENT, because each absence is load-bearing:
 *
 * - **No `sender`.** The acting party comes from the active session, never from
 *   the caller. A caller-supplied sender is a way to ask the wallet to act as
 *   somebody else. Console's own `ExecuteRequest` omits `partyId` for the same
 *   reason.
 * - **No `inputHoldingCids`.** The wallet chooses which of its own holdings to
 *   spend. `@partylayer/react`'s `TokenTransfer` has this field because that type
 *   is Model 2, where the dApp owns the write and picks the holdings; here the
 *   wallet owns the write. Letting the caller steer which holdings are consumed
 *   is a partial return of the thing this design exists to avoid.
 * - **No approval flag.** There is no option, anywhere in this type or reachable
 *   through it, that suppresses the user's confirmation. Unknown keys are
 *   dropped by {@link toTransferIntent} before an adapter sees them, so a caller
 *   cannot smuggle one through to a wallet that might honour it.
 */
export interface TransferIntent {
  /** The party receiving the amount (Daml `Party`). */
  receiver: string;
  /**
   * The amount to transfer, a decimal-as-string to preserve exact precision
   * (Daml `Decimal`). NEVER a JS `number`, which cannot represent large or
   * precise decimals losslessly — a number is rejected rather than coerced.
   */
  amount: string;
  /** The instrument being transferred, and its issuing admin. */
  instrumentId: TokenInstrumentId;
  /**
   * Free-form metadata to carry with the transfer, a string-to-string map (Daml
   * `Metadata`, a `TextMap Text`). An adapter whose wallet cannot carry the full
   * map MUST reject an intent that sets it rather than silently dropping it: the
   * user is shown the metadata as part of what they approve, so quietly not
   * writing it would make the confirmation untrue.
   */
  meta?: Record<string, string>;
  /** Deadline by which the transfer must execute, an ISO 8601 timestamp (Daml `Time`). */
  executeBefore?: string;
}

/**
 * What comes back. Real values or an error — never a placeholder.
 *
 * `updateId` is required and is the ledger's own identifier for the committed
 * update. An adapter that cannot obtain one MUST throw. It must not substitute a
 * command id, a submission id, a signature, or a generated string: a field that
 * says `updateId` and holds something else will eventually be shown to somebody
 * as evidence.
 */
export interface TransferResult {
  /** The ledger update id for the committed transaction. Always real. */
  updateId: string;
  /**
   * The wallet's command id, when the wallet surfaces one. Optional because some
   * wallets do not report it, and inventing one to fill the field is exactly the
   * failure this type exists to prevent.
   */
  commandId?: string;
  /** The completion offset, when the wallet reports it. */
  completionOffset?: number;
  /** The party that signed, from the active session. */
  partyId: PartyId;
}

/**
 * The complete set of fields an adapter may read off an intent. Frozen, and the
 * single source of truth for {@link toTransferIntent}.
 *
 * Adapters build their wallet request from this list and nothing else. That is
 * what makes "the user's approval cannot be suppressed by the caller" a
 * structural property rather than a promise: an unknown key never reaches the
 * wallet, so a wallet that would honour a `skipConfirmation` flag never receives
 * one.
 */
export const TRANSFER_INTENT_FIELDS = Object.freeze([
  'receiver',
  'amount',
  'instrumentId',
  'meta',
  'executeBefore',
] as const);

/** Reject a non-empty string early, with the field named. */
function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TransportError(
      `transfer intent: "${field}" must be a non-empty string (received ${describe(value)})`,
    );
  }
  return value;
}

/** A short, safe description of a bad value for an error message. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

/**
 * Normalize arbitrary caller input into a {@link TransferIntent}, keeping ONLY
 * the fields in {@link TRANSFER_INTENT_FIELDS} and validating each one.
 *
 * Every adapter runs its input through this before touching a wallet SDK, so the
 * allowlist is enforced in one place and tested once. Unknown keys are dropped
 * silently rather than rejected: a caller passing an extra field gets a working
 * transfer without that field, which is the safe outcome, and rejecting would
 * turn a harmless typo into an outage.
 *
 * Throws {@link TransportError} on a malformed intent, matching the precedent set
 * by `ledgerApiBodyToObject` for a bad parameter at the SDK boundary.
 */
export function toTransferIntent(input: unknown): TransferIntent {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TransportError(
      `transfer intent must be an object (received ${describe(input)})`,
    );
  }
  const raw = input as Record<string, unknown>;

  const receiver = requireNonEmptyString(raw.receiver, 'receiver');

  // A JS number is rejected outright rather than stringified: Number cannot hold
  // a large or precise Daml Decimal losslessly, so coercing here would silently
  // change the amount the user is about to approve.
  if (typeof raw.amount === 'number') {
    throw new TransportError(
      'transfer intent: "amount" must be a decimal string, not a number — a JS number cannot represent a Daml Decimal losslessly',
    );
  }
  const amount = requireNonEmptyString(raw.amount, 'amount');

  const instrumentRaw = raw.instrumentId;
  if (typeof instrumentRaw !== 'object' || instrumentRaw === null || Array.isArray(instrumentRaw)) {
    throw new TransportError(
      `transfer intent: "instrumentId" must be an object with "admin" and "id" (received ${describe(instrumentRaw)})`,
    );
  }
  const instrumentObj = instrumentRaw as Record<string, unknown>;
  const instrumentId: TokenInstrumentId = {
    admin: requireNonEmptyString(instrumentObj.admin, 'instrumentId.admin'),
    id: requireNonEmptyString(instrumentObj.id, 'instrumentId.id'),
  };

  const intent: TransferIntent = { receiver, amount, instrumentId };

  if (raw.meta !== undefined) {
    const metaRaw = raw.meta;
    if (typeof metaRaw !== 'object' || metaRaw === null || Array.isArray(metaRaw)) {
      throw new TransportError(
        `transfer intent: "meta" must be a string-to-string object (received ${describe(metaRaw)})`,
      );
    }
    const meta: Record<string, string> = {};
    for (const [key, value] of Object.entries(metaRaw as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        throw new TransportError(
          `transfer intent: "meta.${key}" must be a string (received ${describe(value)})`,
        );
      }
      meta[key] = value;
    }
    intent.meta = meta;
  }

  if (raw.executeBefore !== undefined) {
    intent.executeBefore = requireNonEmptyString(raw.executeBefore, 'executeBefore');
  }

  return intent;
}
