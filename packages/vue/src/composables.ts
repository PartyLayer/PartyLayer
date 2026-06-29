/**
 * Vue composables over the `@partylayer/session` store. Wagmi/React parity:
 * `useSession` (reactive state + actions), `useAccount`, `useAccountEffect`.
 *
 * Each composable derives individual `ComputedRef`s from ONE internal
 * `shallowRef<SessionState>` fed by a single `store.subscribe`, cleaned up via
 * `onScopeDispose` (no leak after unmount). Returning refs, not a `reactive()`
 * object, means destructuring keeps reactivity.
 *
 * SSR-safe: with no provided store the refs report a disconnected session and
 * the actions are no-ops; nothing touches `window`.
 */
import { computed, onScopeDispose, shallowRef, type ComputedRef } from 'vue';
import type {
  SessionAccount,
  SessionEvent,
  SessionState,
  SessionStatus,
} from '@partylayer/session';
import { injectSessionStore } from './provide';

const DISCONNECTED: SessionState = {
  status: 'disconnected',
  account: null,
  accounts: [],
  networkId: null,
  lastError: null,
};

/** Subscribe ONCE to the provided store; returns a reactive snapshot ref. */
function useSessionState() {
  const store = injectSessionStore();
  const state = shallowRef<SessionState>(store ? store.getSnapshot() : DISCONNECTED);
  if (store) {
    const unsubscribe = store.subscribe(() => {
      state.value = store.getSnapshot();
    });
    onScopeDispose(unsubscribe);
  }
  return { store, state };
}

/** wagmi-parity chain handle derived from the CAIP-2 networkId. */
export interface SessionChain {
  id: string;
}

export interface UseSessionReturn {
  status: ComputedRef<SessionStatus>;
  account: ComputedRef<SessionAccount | null>;
  accounts: ComputedRef<readonly SessionAccount[]>;
  networkId: ComputedRef<string | null>;
  lastError: ComputedRef<Error | null>;
  isConnected: ComputedRef<boolean>;
  isConnecting: ComputedRef<boolean>;
  isReconnecting: ComputedRef<boolean>;
  isDisconnected: ComputedRef<boolean>;
  /** Connect via the store (mirrors the store's own signature exactly). */
  connect(params?: Record<string, unknown>): Promise<SessionState>;
  disconnect(): Promise<void>;
  restore(): Promise<SessionState>;
  /** Subscribe to a structured resilience/sync event (narrowed by `event`). */
  on<T extends SessionEvent['type']>(
    event: T,
    handler: (event: Extract<SessionEvent, { type: T }>) => void,
  ): () => void;
}

/** Reactive session state + bound actions. */
export function useSession(): UseSessionReturn {
  const { store, state } = useSessionState();
  return {
    status: computed(() => state.value.status),
    account: computed(() => state.value.account),
    accounts: computed(() => state.value.accounts),
    networkId: computed(() => state.value.networkId),
    lastError: computed(() => state.value.lastError),
    isConnected: computed(() => state.value.status === 'connected'),
    isConnecting: computed(() => state.value.status === 'connecting'),
    isReconnecting: computed(() => state.value.status === 'reconnecting'),
    isDisconnected: computed(() => state.value.status === 'disconnected'),
    connect: (params?: Record<string, unknown>) =>
      store ? store.connect(params) : Promise.resolve(DISCONNECTED),
    disconnect: () => (store ? store.disconnect() : Promise.resolve()),
    restore: () => (store ? store.restore() : Promise.resolve(DISCONNECTED)),
    on: <T extends SessionEvent['type']>(
      event: T,
      handler: (event: Extract<SessionEvent, { type: T }>) => void,
    ): (() => void) => (store ? store.on(event, handler as (e: SessionEvent) => void) : () => {}),
  };
}

export interface UseAccountReturn {
  party: ComputedRef<string | null>;
  /** wagmi-parity alias of `party`. */
  address: ComputedRef<string | null>;
  account: ComputedRef<SessionAccount | null>;
  accounts: ComputedRef<readonly SessionAccount[]>;
  status: ComputedRef<SessionStatus>;
  isConnected: ComputedRef<boolean>;
  isConnecting: ComputedRef<boolean>;
  isReconnecting: ComputedRef<boolean>;
  isDisconnected: ComputedRef<boolean>;
  networkId: ComputedRef<string | null>;
  chain: ComputedRef<SessionChain | null>;
  lastError: ComputedRef<Error | null>;
}

/** Reactive active-account view (wagmi parity). */
export function useAccount(): UseAccountReturn {
  const { state } = useSessionState();
  const party = computed(() => state.value.account?.partyId ?? null);
  return {
    party,
    address: party,
    account: computed(() => state.value.account),
    accounts: computed(() => state.value.accounts),
    status: computed(() => state.value.status),
    isConnected: computed(() => state.value.status === 'connected'),
    isConnecting: computed(() => state.value.status === 'connecting'),
    isReconnecting: computed(() => state.value.status === 'reconnecting'),
    isDisconnected: computed(() => state.value.status === 'disconnected'),
    networkId: computed(() => state.value.networkId),
    chain: computed(() => (state.value.networkId ? { id: state.value.networkId } : null)),
    lastError: computed(() => state.value.lastError),
  };
}

export interface UsePartyStateReturn {
  /** Active party id (Canton's address analog), or null when no party is present. */
  party: ComputedRef<string | null>;
  /** Full active (primary) account, or null. */
  account: ComputedRef<SessionAccount | null>;
  /** All accounts the wallet exposed. */
  accounts: ComputedRef<readonly SessionAccount[]>;
  /** Connection status state-machine value. */
  status: ComputedRef<SessionStatus>;
  /** True when a party is present (status is `connected`). */
  isConnected: ComputedRef<boolean>;
  /** True when no party is present (status is `disconnected`). */
  isDisconnected: ComputedRef<boolean>;
  /** Active network in CAIP-2 form, or null. */
  networkId: ComputedRef<string | null>;
  /** Last connect/restore error, or null. */
  lastError: ComputedRef<Error | null>;
}

/**
 * Reactive party-state composable: the party-focused view of the active session,
 * the Vue mirror of React's `usePartyState`. It answers "which party am I, and is
 * it present?" where {@link useAccount} answers "what is my wagmi-style account and
 * connection?". Both read the SAME reactive session store.
 *
 * BUILT ON useAccount: this composable calls {@link useAccount} internally and
 * passes through its `ComputedRef`s for the party-centric subset. It does NOT
 * re-read the store or re-implement the computed logic, so there is ONE source of
 * truth and its behavior is identical to the proven composable. It is SSR-safe for
 * the same reason (it inherits useAccount's disconnected snapshot).
 *
 * SURFACE (why it differs from useAccount): it exposes only genuine party/account
 * state plus the two party-presence booleans, mirroring React's `usePartyState`. It
 * deliberately OMITS useAccount's wagmi-connection emphasis, which is useAccount's
 * job: `address` (a redundant alias of `party` here), `chain` (a connection handle,
 * not party identity), and `isConnecting`/`isReconnecting` (transient connection
 * flow; party presence is `isConnected`/`isDisconnected`, and the full `status` is
 * still exposed). Every field is a `ComputedRef` (Vue's idiom), where React returns
 * plain values. Use `useAccount` for the wagmi-style surface; both are backed by the
 * same store, so they never disagree.
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

export interface UseAccountEffectParameters {
  /** Fired on a transition INTO `connected` (once the account is available). */
  onConnect?: (data: {
    account: SessionAccount | null;
    accounts: readonly SessionAccount[];
    networkId: string | null;
  }) => void;
  /** Fired on a transition `connected → disconnected`. */
  onDisconnect?: () => void;
  /** Fired when the active PRIMARY party changes (a switch, not a reorder). */
  onPartyChanged?: (data: { previous: string | null; current: string | null }) => void;
}

/**
 * Fire side-effects on session transitions, no render churn. Auto-cleans on
 * scope teardown (`onScopeDispose`). No-op when no store is provided.
 */
export function useAccountEffect(parameters: UseAccountEffectParameters = {}): void {
  const store = injectSessionStore();
  if (!store) return;

  let prev: SessionStatus = store.getSnapshot().status;
  // statusChanged(connected) can arrive BEFORE accountsChanged, so fire
  // onConnect once per session on the tick the account becomes available.
  let firedConnect = false;

  const unsubscribe = store.subscribe(() => {
    const next = store.getSnapshot();
    const was = prev;
    const now = next.status;
    prev = now;
    if (now === 'connected') {
      if (!firedConnect && next.account) {
        firedConnect = true;
        parameters.onConnect?.({
          account: next.account,
          accounts: next.accounts,
          networkId: next.networkId,
        });
      }
    } else if (now === 'disconnected' && (was === 'connected' || firedConnect)) {
      firedConnect = false;
      parameters.onDisconnect?.();
    }
  });

  const unsubscribeParty = store.on('party:changed', (e) => {
    if (e.type === 'party:changed') {
      parameters.onPartyChanged?.({ previous: e.previous, current: e.current });
    }
  });

  onScopeDispose(() => {
    unsubscribe();
    unsubscribeParty();
  });
}
