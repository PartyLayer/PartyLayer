/**
 * Account and session hooks over the shared @partylayer/session store.
 *
 * These mirror the react package's `useAccount`, `useSession` and `useAccountEffect`, and
 * they read the SAME framework-agnostic store, so the mental model carries over from web
 * unchanged. They read the store `PartyLayerProvider` creates, so unlike the client-based
 * hooks they require the provider and say so when it is missing.
 *
 * Reminder that matters on React Native: without an `asyncStorage` on the provider the
 * store is in-memory, so `status` starts `disconnected` on every app launch. See the
 * package README.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type {
  SessionAccount,
  SessionEvent,
  SessionState,
  SessionStatus,
} from '@partylayer/session';
import { usePartyLayerContext } from './party-layer-context';

// Must be a stable reference: useSyncExternalStore compares snapshots by identity, so a
// fresh object here would loop.
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

/** Chain handle derived from the CAIP-2 networkId. */
export interface SessionChain {
  /** CAIP-2 network id, for example "canton:devnet". */
  id: string;
}

export interface UseAccountResult {
  /** Active party id, Canton's address analog, or null. */
  party: string | null;
  /** Alias of `party`, for parity with the web package. */
  address: string | null;
  /** Full active account, or null. */
  account: SessionAccount | null;
  /** Every account the wallet exposed. */
  accounts: readonly SessionAccount[];
  status: SessionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  networkId: string | null;
  chain: SessionChain | null;
  lastError: Error | null;
}

function deriveAccount(state: SessionState): UseAccountResult {
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
 * The active account and connection status, live.
 *
 * Requires `PartyLayerProvider`, because it reads the shared session store.
 */
export function useAccount(): UseAccountResult {
  const { store } = usePartyLayerContext();

  const snapshot = useSyncExternalStore<SessionState>(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getDisconnectedSnapshot,
    getDisconnectedSnapshot,
  );

  return deriveAccount(snapshot);
}

export interface UseSessionResult extends SessionState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  isDisconnected: boolean;
  /** Connect through the store. */
  connect(params?: Record<string, unknown>): Promise<SessionState>;
  /** Disconnect through the store. Does not auto reconnect afterwards. */
  disconnect(): Promise<void>;
  /** Rehydrate from the live provider plus the persisted marker. */
  restore(): Promise<SessionState>;
  /** Subscribe to a structured session event, narrowed by `event`. */
  on<T extends SessionEvent['type']>(
    event: T,
    handler: (event: Extract<SessionEvent, { type: T }>) => void,
  ): () => void;
}

/**
 * The full reactive session state plus the store's actions.
 *
 * Requires `PartyLayerProvider`, because it reads the shared session store.
 */
export function useSession(): UseSessionResult {
  const { store } = usePartyLayerContext();

  const snapshot = useSyncExternalStore<SessionState>(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : getDisconnectedSnapshot,
    getDisconnectedSnapshot,
  );

  // Stable per store, so a consumer can put these in a dependency array.
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
  /** Fired on a transition into `connected`, once per session. */
  onConnect?: (data: {
    account: SessionAccount | null;
    accounts: readonly SessionAccount[];
    networkId: string | null;
  }) => void;
  /** Fired on a `connected` to `disconnected` transition. */
  onDisconnect?: () => void;
  /** Fired when the active primary party changes. */
  onPartyChanged?: (data: { previous: string | null; current: string | null }) => void;
}

/**
 * Run side effects on session transitions without causing renders.
 *
 * Requires `PartyLayerProvider`, because it reads the shared session store.
 */
export function useAccountEffect(parameters: UseAccountEffectParameters = {}): void {
  const { store } = usePartyLayerContext();

  // Hold the latest callbacks without resubscribing on every render.
  const parametersRef = useRef(parameters);
  parametersRef.current = parameters;

  useEffect(() => {
    if (!store) return;

    let previous: SessionStatus = store.getSnapshot().status;
    // The store reports `connected` before the accounts arrive, so the first connected
    // tick has no account yet. Fire onConnect once per session, on the tick where the
    // account exists, and arm it again after a disconnect.
    let firedConnect = false;

    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      const was = previous;
      const now = next.status;
      previous = now;

      if (now === 'connected') {
        if (!firedConnect && next.account) {
          firedConnect = true;
          parametersRef.current.onConnect?.({
            account: next.account,
            accounts: next.accounts,
            networkId: next.networkId,
          });
        }
      } else if (now === 'disconnected' && (was === 'connected' || firedConnect)) {
        firedConnect = false;
        parametersRef.current.onDisconnect?.();
      }
    });

    const unsubscribeParty = store.on('party:changed', (event) => {
      if (event.type === 'party:changed') {
        parametersRef.current.onPartyChanged?.({ previous: event.previous, current: event.current });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeParty();
    };
  }, [store]);
}
