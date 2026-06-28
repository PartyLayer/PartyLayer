'use client';

/**
 * React hooks over the @partylayer/session core (Step 6b).
 *
 * NEW, additive hooks, `useAccount` and `useAccountEffect`, with wagmi
 * parity. They read the shared `SessionStore` created by `PartyLayerProvider`
 * via `useSyncExternalStore`. The existing `useSession` (SDK-layer) is left
 * untouched; the two coexist until the M2 react v2 unification.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import type {
  SessionAccount,
  SessionEvent,
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
 * SSR-safe: `getServerSnapshot` returns a stable disconnected snapshot.
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

/**
 * Reactive session: the full `SessionState` (live, via `useSyncExternalStore`)
 * plus the store's actions and the resilience/sync event subscription.
 *
 * NOTE: this is the NEW meaning of `useSession()`. The previous SDK-layer
 * getter (`return context.session`) is preserved VERBATIM as `useClientSession()`.
 * Migration: `useSession()` (old) → `useClientSession()`.
 *
 * SSR-safe: with no store (server / outside provider) it returns the stable
 * disconnected snapshot and no-op actions; no `window`/BroadcastChannel access.
 */
export interface UseSessionReturn extends SessionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  /** Connect via the store (CIP-0103 `connect`). */
  connect(params?: Record<string, unknown>): Promise<SessionState>;
  /** Disconnect via the store (never auto-reconnects after). */
  disconnect(): Promise<void>;
  /** Restore/rehydrate from the live provider + persisted marker/snapshot. */
  restore(): Promise<SessionState>;
  /** Subscribe to a structured resilience/sync event (narrowed by `event`). */
  on<T extends SessionEvent['type']>(
    event: T,
    handler: (event: Extract<SessionEvent, { type: T }>) => void,
  ): () => void;
}

export function useSession(): UseSessionReturn {
  const { store } = usePartyLayerContext();

  const snapshot = useSyncExternalStore<SessionState>(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getDisconnectedSnapshot,
    getDisconnectedSnapshot,
  );

  // Actions are stable per-store (memoized) so consumers can depend on them.
  const actions = useMemo(
    () => ({
      connect: (params?: Record<string, unknown>): Promise<SessionState> =>
        store ? store.connect(params) : Promise.resolve(DISCONNECTED_SNAPSHOT),
      disconnect: (): Promise<void> => (store ? store.disconnect() : Promise.resolve()),
      restore: (): Promise<SessionState> =>
        store ? store.restore() : Promise.resolve(DISCONNECTED_SNAPSHOT),
      on: <T extends SessionEvent['type']>(
        event: T,
        handler: (event: Extract<SessionEvent, { type: T }>) => void,
      ): (() => void) =>
        store ? store.on(event, handler as (e: SessionEvent) => void) : () => {},
    }),
    [store],
  );

  return {
    ...snapshot,
    isConnected: snapshot.status === 'connected',
    isConnecting: snapshot.status === 'connecting',
    isReconnecting: snapshot.status === 'reconnecting',
    isDisconnected: snapshot.status === 'disconnected',
    ...actions,
  };
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
  /**
   * fired when the active PRIMARY party changes (the session
   * `party:changed` event, a true switch, not a list reorder).
   */
  onPartyChanged?: (data: { previous: string | null; current: string | null }) => void;
}

/**
 * Fire side-effects on session status transitions, no render churn.
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

    // party-switch side-effect via the store's structured event.
    const unsubscribeParty = store.on('party:changed', (e) => {
      if (e.type === 'party:changed') {
        paramsRef.current.onPartyChanged?.({ previous: e.previous, current: e.current });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeParty();
    };
  }, [store]);
}
