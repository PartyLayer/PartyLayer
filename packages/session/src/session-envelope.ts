/**
 * Versioned SESSION payload envelope + migration scaffold + restore/reconcile
 * helpers.
 *
 * This is the PLAINTEXT that the encrypted backends persist (compose:
 * `storage.setItem(key, encodeSessionEnvelope(snapshot))`). It carries an
 * explicit `version` so the session SCHEMA can evolve — `migrateSessionEnvelope`
 * is the switch-on-version scaffold that seeds the "schema migration
 * helpers" acceptance item. (Distinct from the crypto-envelope format version
 * in crypto.ts, which governs the at-rest ciphertext shape.)
 *
 * Field names mirror the REAL session shape (`SessionState` in types.ts /
 * `CIP0103Account`): `account`, `accounts`, `networkId`, plus `connectedAt`
 * and an optional `expiresAt`.
 *
 * SAFETY: decode of a corrupt string or an unknown FUTURE schema version returns
 * `null` (never throws); `restoreSession` additionally CLEARS such an entry so a
 * forward-incompatible blob can't wedge the app.
 */
import type { SessionAccount } from './types';
import type { SessionStorage } from './storage';

/** Current session-schema envelope version. Bump + extend `migrate` on shape changes. */
export const CURRENT_SESSION_ENVELOPE_VERSION = 1 as const;

/** The persisted session snapshot (schema v1). */
export interface PersistedSessionSnapshot {
  /** Active (primary) account/party, or null. */
  readonly account: SessionAccount | null;
  /** All accounts the wallet exposed. */
  readonly accounts: readonly SessionAccount[];
  /** Active CAIP-2 network, or null. */
  readonly networkId: string | null;
  /** Epoch ms when this session was persisted/connected. */
  readonly connectedAt: number;
  /** Optional epoch-ms expiry; restore drops the snapshot once past it. */
  readonly expiresAt?: number;
}

/** On-the-wire envelope: a version tag spread over the snapshot. */
interface SessionEnvelopeV1 extends PersistedSessionSnapshot {
  readonly version: 1;
}

/** Serialize a snapshot into the versioned envelope JSON string (the plaintext to encrypt). */
export function encodeSessionEnvelope(snapshot: PersistedSessionSnapshot): string {
  const env: SessionEnvelopeV1 = { version: CURRENT_SESSION_ENVELOPE_VERSION, ...snapshot };
  return JSON.stringify(env);
}

/**
 * Migration scaffold — switch on the envelope `version` and return a
 * current-shape snapshot, or `null` for an UNKNOWN (future / unsupported)
 * version. Add `case 2:` etc. here as the schema evolves; older versions map
 * forward into {@link PersistedSessionSnapshot}.
 */
export function migrateSessionEnvelope(parsed: unknown): PersistedSessionSnapshot | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const v = (parsed as { version?: unknown }).version;
  switch (v) {
    case 1: {
      const e = parsed as Partial<SessionEnvelopeV1>;
      if (!Array.isArray(e.accounts)) return null;
      return {
        account: e.account ?? null,
        accounts: e.accounts,
        networkId: e.networkId ?? null,
        connectedAt: typeof e.connectedAt === 'number' ? e.connectedAt : 0,
        ...(typeof e.expiresAt === 'number' ? { expiresAt: e.expiresAt } : {}),
      };
    }
    default:
      // Unknown/future version — refuse rather than guess. Caller clears it.
      return null;
  }
}

/** Decode an envelope plaintext into a snapshot, or `null` (corrupt / unknown version). Never throws. */
export function decodeSessionEnvelope(plaintext: string): PersistedSessionSnapshot | null {
  try {
    return migrateSessionEnvelope(JSON.parse(plaintext));
  } catch {
    return null;
  }
}

/**
 * Read + decode a persisted session from any {@link SessionStorage} (typically
 * an encrypted backend). Returns `null` and CLEARS the entry when the blob is
 * absent, corrupt, a wrong/unknown version, or expired — never throws.
 */
export async function restoreSession(
  storage: SessionStorage,
  key: string,
  now: number = epochNow(),
): Promise<PersistedSessionSnapshot | null> {
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;

  const snapshot = decodeSessionEnvelope(raw);
  if (!snapshot) {
    // Forward-incompatible/garbage plaintext (the crypto layer already drops
    // wrong-key/corrupt ciphertext). Clear so it can't wedge future restores.
    try {
      await storage.removeItem(key);
    } catch {
      /* best-effort */
    }
    return null;
  }
  if (typeof snapshot.expiresAt === 'number' && now >= snapshot.expiresAt) {
    try {
      await storage.removeItem(key);
    } catch {
      /* best-effort */
    }
    return null;
  }
  return snapshot;
}

/** Pure-ish epoch helper (kept separate so callers/tests can inject `now`). */
function epochNow(): number {
  return new Date().getTime();
}

// ── Reconcile: optimistic snapshot vs live wallet status ─────────────────────

/** The live wallet status the restored snapshot is reconciled against. */
export interface LiveSessionStatus {
  readonly account: SessionAccount | null;
  readonly networkId: string | null;
}

/** One field-level difference between the persisted snapshot and live status. */
export interface SessionDiff {
  readonly field: 'account' | 'networkId';
  readonly persisted: string | null;
  readonly live: string | null;
}

/** Structured reconcile result — `matches` true iff there are no diffs. */
export interface ReconcileResult {
  readonly matches: boolean;
  readonly diffs: readonly SessionDiff[];
}

/**
 * Compare an optimistic restored snapshot against the live wallet status and
 * emit a STRUCTURED diff (never throws). The framework layer uses this to decide
 * whether the optimistic snapshot can stand or must be reconciled/cleared
 * (e.g. user switched account/network in the wallet while away).
 */
export function reconcileSession(
  snapshot: PersistedSessionSnapshot,
  live: LiveSessionStatus,
): ReconcileResult {
  const diffs: SessionDiff[] = [];
  const persistedParty = snapshot.account?.partyId ?? null;
  const liveParty = live.account?.partyId ?? null;
  if (persistedParty !== liveParty) {
    diffs.push({ field: 'account', persisted: persistedParty, live: liveParty });
  }
  if ((snapshot.networkId ?? null) !== (live.networkId ?? null)) {
    diffs.push({ field: 'networkId', persisted: snapshot.networkId ?? null, live: live.networkId ?? null });
  }
  return { matches: diffs.length === 0, diffs };
}
