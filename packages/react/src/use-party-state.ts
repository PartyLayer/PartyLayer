'use client';

/**
 * @partylayer/react v2: usePartyState (reactive party-state hook).
 *
 * The party-focused view of the active session. It answers "which party am I, and
 * is it present?" where {@link useAccount} answers "what is my wagmi-style
 * account/connection?". Both read the SAME reactive session store.
 *
 * NOT A QUERY: party state is a synchronous reactive store value, not async server
 * state, so this is read via `useSyncExternalStore` (through `useAccount`), NOT via
 * TanStack `useQuery`. wagmi models the equivalent (`useAccount`) the same way: it
 * is reactive store state, not a query. That is why this hook lives on the main
 * entrypoint next to `useAccount`/`useSession`, not on `/query`.
 *
 * BUILT ON useAccount: this hook calls {@link useAccount} internally and projects
 * its result to a party-centric surface. It does NOT re-implement the store
 * subscription, so there is ONE source of truth and behavior is identical to the
 * proven hook. It is SSR-safe for the same reason: it inherits `useAccount`'s
 * stable disconnected snapshot (no `window` access, no hydration mismatch).
 *
 * SURFACE (why it differs from useAccount): this exposes only genuine party/account
 * state plus the two party-presence booleans. It deliberately OMITS useAccount's
 * wagmi-connection emphasis, which is useAccount's job:
 *  - `address` (a wagmi alias of `party`): redundant here; `party` is the name.
 *  - `chain` (a wagmi chain handle): connection-framing, not party identity.
 *  - `isConnecting` / `isReconnecting`: transient connection-flow detail; party
 *    presence is captured by `isConnected` / `isDisconnected`, and the full
 *    `status` is still exposed for callers that need the state-machine value.
 * If you want the wagmi-style surface (address, chain, connecting flags), use
 * `useAccount`. Both are backed by the same store, so they never disagree.
 */
import type { SessionAccount, SessionStatus } from '@partylayer/session';
import { useAccount } from './session-hooks';

export interface UsePartyStateReturn {
  /** Active party id (Canton's address analog), or null when no party is present. */
  party: string | null;
  /** Full active (primary) account, or null. */
  account: SessionAccount | null;
  /** All accounts the wallet exposed. */
  accounts: readonly SessionAccount[];
  /** Connection status state-machine value. */
  status: SessionStatus;
  /** True when a party is present (status is `connected`). */
  isConnected: boolean;
  /** True when no party is present (status is `disconnected`). */
  isDisconnected: boolean;
  /** Active network in CAIP-2 form, or null. */
  networkId: string | null;
  /** Last connect/restore error, or null. */
  lastError: Error | null;
}

/**
 * Read the active party/account state from the shared session store.
 *
 * Reactive (re-renders when the store updates) and SSR-safe (stable disconnected
 * snapshot on the server / outside a provider), inherited from {@link useAccount}.
 */
export function usePartyState(): UsePartyStateReturn {
  const { party, account, accounts, status, isConnected, isDisconnected, networkId, lastError } =
    useAccount();

  return {
    party,
    account,
    accounts,
    status,
    isConnected,
    isDisconnected,
    networkId,
    lastError,
  };
}
