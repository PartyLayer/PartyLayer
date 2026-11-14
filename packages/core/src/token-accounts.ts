import type { TokenHolding, TokenHoldingRef, TokenLock } from './token-holdings';
import type { TokenInstrumentId } from './transfer';

/** Splice.Api.Token.HoldingV2.Account. Missing owners are reserved for admin accounts. */
export interface TokenAccount {
  owner?: string;
  provider?: string;
  /** The empty string identifies the default account. */
  id: string;
}

/** HoldingV2 retains the complete account; a provider is not the asset owner. */
export interface TokenHoldingV2 {
  account: TokenAccount;
  instrumentId: TokenInstrumentId;
  amount: string;
  lock?: TokenLock;
  meta?: Record<string, string>;
}

export interface TokenHoldingV2Ref {
  cid: string;
  holding: TokenHoldingV2;
}

export type AnyTokenHoldingRef = TokenHoldingRef | TokenHoldingV2Ref;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid token standard record');
  return value as Record<string, unknown>;
}

function identifier(value: unknown, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value) || value.length > 2048 || /\p{Cc}/u.test(value)) {
    throw new Error('Invalid token standard identifier');
  }
  return value;
}

function optionalIdentifier(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : identifier(value);
}

export function parseTokenAccount(value: unknown): TokenAccount {
  const account = record(value);
  const owner = optionalIdentifier(account.owner);
  const provider = optionalIdentifier(account.provider);
  return { ...(owner ? { owner } : {}), ...(provider ? { provider } : {}), id: identifier(account.id, true) };
}

function commonHolding(value: Record<string, unknown>) {
  const instrument = record(value.instrumentId);
  if (typeof value.amount !== 'string' || !/^(?:0|[1-9]\d{0,27})(?:\.\d{1,10})?$/.test(value.amount)) {
    throw new Error('Invalid token decimal');
  }
  let lock: TokenLock | undefined;
  if (value.lock !== undefined && value.lock !== null) {
    const raw = record(value.lock);
    if (!Array.isArray(raw.holders)) throw new Error('Invalid holding lock');
    lock = { holders: raw.holders.map(v => identifier(v)) };
    for (const key of ['expiresAt', 'expiresAfter'] as const) {
      const field = optionalIdentifier(raw[key]);
      if (field !== undefined) lock[key] = field;
    }
    if (raw.context !== undefined && raw.context !== null) {
      if (typeof raw.context !== 'string') throw new Error('Invalid holding lock context');
      lock.context = raw.context;
    }
  }
  let meta: Record<string, string> | undefined;
  if (value.meta !== undefined && value.meta !== null) {
    const raw = record(value.meta);
    const values = Object.hasOwn(raw, 'values') ? record(raw.values) : raw;
    if (Object.values(values).some(v => typeof v !== 'string')) throw new Error('Invalid holding metadata');
    meta = { ...values } as Record<string, string>;
  }
  return { instrumentId: { admin: identifier(instrument.admin), id: identifier(instrument.id) },
    amount: value.amount, ...(lock ? { lock } : {}), ...(meta ? { meta } : {}) };
}

/** Validate the actual interface view; never guess a standard version from fields. */
export function parseTokenHoldingV1(value: unknown): TokenHolding {
  const raw = record(value);
  return { owner: identifier(raw.owner), ...commonHolding(raw) };
}

export function parseTokenHoldingV2(value: unknown): TokenHoldingV2 {
  const raw = record(value);
  return { account: parseTokenAccount(raw.account), ...commonHolding(raw) };
}

export function tokenHoldingOwner(holding: TokenHolding | TokenHoldingV2): string | undefined {
  return 'account' in holding ? holding.account.owner : holding.owner;
}
