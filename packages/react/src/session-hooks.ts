/**
 * React hooks over the @partylayer/session core (Step 6b).
 *
 * NEW, additive hooks — `useAccount` and `useAccountEffect` — with wagmi
 * parity. They read the shared `SessionStore` created by `PartyLayerProvider`
 * via `useSyncExternalStore`. The existing `useSession` (SDK-layer) is left
 * untouched; the two coexist until the M2 react v2 unification.
 */

import { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import type {
  SessionAccount,
  SessionState,
  SessionStatus,
} from '@partylayer/session';
import { usePartyLayerContext } from './context';

// ── Stable disconnected snapshot (SSR + no-store fallback) ───────────────────
// MUST be a stable reference: `useSyncExternalStore` compares snapshots by
// identity, so returning a fresh object here would loop / mismatch hydration.
const DISCONNECTED_SNAPSHOT: SessionState = {
  status: 'disconnected',
  account: null,
  accounts: [],
  networkId: null,
  lastError: null,
};

function getDisconnectedSnapshot(): SessionState {
  return DISCONNECTED_SNAPSHOT;
}

function noopSubscribe(): () => void {
  return () => {};
}

/** wagmi-parity-ish chain handle derived from the CAIP-2 networkId. */
export interface SessionChain {
  /** CAIP-2 network id, e.g. "canton:da-mainnet". */
  id: string;
}

export interface UseAccountReturn {
  /** Active party id (Canton's address analog), or null. */
  party: string | null;
  /** wagmi-parity alias of `party`. */
  address: string | null;
  /** Full active (primary) account, or null. */
  account: SessionAccount | null;
  /** All accounts the wallet exposed. */
  accounts: readonly SessionAccount[];
  /** Connection status state-machine value. */
  status: SessionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  /** Active network in CAIP-2 form, or null. */
  networkId: string | null;
  /** wagmi-parity chain handle derived from `networkId`, or null. */
  chain: SessionChain | null;
  /** Last connect/restore error, or null. */
  lastError: Error | null;
}

function deriveAccount(state: SessionState): UseAccountReturn {
  const party = state.account?.partyId ?? null;
  return {
    party,
    address: party,
    account: state.account,
    accounts: state.accounts,
    status: state.status,
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isReconnecting: state.status === 'reconnecting',
    isDisconnected: state.status === 'disconnected',
    networkId: state.networkId,
    chain: state.networkId ? { id: state.networkId } : null,
    lastError: state.lastError,
  };
}

/**
 * Read the active account/connection from the shared session store.
 *
 * wagmi parity: `useAccount()` returns `{ address, status, isConnected, ... }`.
 * SSR-safe — `getServerSnapshot` returns a stable disconnected snapshot.
 */
export function useAccount(): UseAccountReturn {
  const { store } = usePartyLayerContext();

  const snapshot = useSyncExternalStore<SessionState>(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getDisconnectedSnapshot,
    getDisconnectedSnapshot,
  );

  return deriveAccount(snapshot);
}

export interface UseAccountEffectParameters {
  /** Fired on a transition INTO `connected` (from disconnected/connecting/reconnecting). */
  onConnect?: (data: {
    account: SessionAccount | null;
    accounts: readonly SessionAccount[];
    networkId: string | null;
  }) => void;
  /** Fired on a transition `connected → disconnected`. */
  onDisconnect?: () => void;
}

/**
 * Fire side-effects on session status transitions — no render churn.
 *
 * - `onConnect` runs once when status becomes `connected`.
 * - `onDisconnect` runs once on `connected → disconnected`.
 */
export function useAccountEffect(
  parameters: UseAccountEffectParameters = {},
): void {
  const { store } = usePartyLayerContext();

  // Keep the latest callbacks without re-subscribing on every render.
  const paramsRef = useRef(parameters);
  paramsRef.current = parameters;

  useEffect(() => {
    if (!store) return;

    let prev: SessionStatus = store.getSnapshot().status;
    // The provider emits `statusChanged` (connected) BEFORE `accountsChanged`,
    // so the first "connected" tick has no account yet. We fire `onConnect`
    // exactly once per session, deferred to the tick where the account is
    // available, and reset on disconnect.
    let firedConnect = false;

    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      const was = prev;
      const now = next.status;
      prev = now;

      if (now === 'connected') {
        if (!firedConnect && next.account) {
          firedConnect = true;
          paramsRef.current.onConnect?.({
            account: next.account,
            accounts: next.accounts,
            networkId: next.networkId,
          });
        }
      } else if (now === 'disconnected' && (was === 'connected' || firedConnect)) {
        firedConnect = false;
        paramsRef.current.onDisconnect?.();
      }
    });

    return unsubscribe;
  }, [store]);
}
