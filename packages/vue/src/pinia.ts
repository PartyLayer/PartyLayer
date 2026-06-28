/**
 * Optional Pinia integration for @partylayer/vue (centralized state management).
 *
 * This is an OPTION, not the default. The default is provide/inject
 * (`provideSessionStore` / `createPartyLayerSession`) plus the composables
 * (`useSession` / `useAccount` / `usePartyState`), which need no Pinia. This module
 * is for teams that already centralize state in Pinia and want the PartyLayer session
 * in their store. It is published on a SUBPATH (`@partylayer/vue/pinia`), so `pinia`
 * is only pulled in when you import this; consumers who do not use Pinia import the
 * main entry and never need `pinia` installed. `pinia` is an OPTIONAL peer dependency.
 *
 * It wraps the SAME `@partylayer/session` `SessionStore` the composables wrap: a
 * Pinia setup store holds a `shallowRef<SessionState>` synced via `store.subscribe`
 * (mirroring the composables), exposes the session state as reactive getters, and
 * delegates the actions (connect/disconnect/restore) to the session store. The state
 * surface matches `usePartyState` (party, account, accounts, status, isConnected,
 * isDisconnected, networkId, lastError), so the Pinia store and the composables agree.
 *
 * API: `definePartyLayerStore(store)` takes the SessionStore (e.g. the one
 * `provideSessionStore(...)` returns, or one from `createSessionStore(...)`) and
 * returns a Pinia `useStore` composable bound to it. Taking the store explicitly keeps
 * it robust (no inject-timing dependency) and lets it share the exact session store a
 * consumer already set up with `createPartyLayerSession`.
 *
 * Usage:
 *   import { createPinia } from 'pinia';
 *   import { definePartyLayerStore } from '@partylayer/vue/pinia';
 *   const usePartyLayerStore = definePartyLayerStore(sessionStore);
 *   // in a component setup(): const pl = usePartyLayerStore(); pl.party; pl.connect();
 */
import { defineStore } from 'pinia';
import { computed, onScopeDispose, shallowRef } from 'vue';
import type { SessionAccount, SessionState, SessionStatus, SessionStore } from '@partylayer/session';

const DISCONNECTED: SessionState = {
  status: 'disconnected',
  account: null,
  accounts: [],
  networkId: null,
  lastError: null,
};

/** The reactive surface a PartyLayer Pinia store exposes (state getters + actions). */
export interface PartyLayerStoreSurface {
  status: SessionStatus;
  account: SessionAccount | null;
  accounts: readonly SessionAccount[];
  networkId: string | null;
  lastError: Error | null;
  /** Active party id (alias of `account.partyId`), or null. */
  party: string | null;
  isConnected: boolean;
  isDisconnected: boolean;
  /** Connect via the wrapped session store. */
  connect: (params?: Record<string, unknown>) => Promise<SessionState>;
  /** Disconnect via the wrapped session store. */
  disconnect: () => Promise<void>;
  /** Restore/rehydrate via the wrapped session store. */
  restore: () => Promise<SessionState>;
}

/**
 * Define a Pinia store bound to a PartyLayer `SessionStore`. Returns a Pinia
 * `useStore` composable. The wrapped session store is the single source of truth; the
 * Pinia store mirrors its state reactively and delegates its actions.
 *
 * @param store the session store to wrap (e.g. the one `provideSessionStore` returns).
 * @param id the Pinia store id. Defaults to `"partylayer"`.
 */
export function definePartyLayerStore(store: SessionStore, id = 'partylayer') {
  return defineStore(id, () => {
    // One subscription to the session store, kept in a shallowRef (mirrors the
    // composables). Cleaned up when the Pinia store's scope is disposed.
    const state = shallowRef<SessionState>(store ? store.getSnapshot() : DISCONNECTED);
    if (store) {
      const unsubscribe = store.subscribe(() => {
        state.value = store.getSnapshot();
      });
      onScopeDispose(unsubscribe);
    }

    const status = computed(() => state.value.status);
    const account = computed(() => state.value.account);
    const accounts = computed(() => state.value.accounts);
    const networkId = computed(() => state.value.networkId);
    const lastError = computed(() => state.value.lastError);
    const party = computed(() => state.value.account?.partyId ?? null);
    const isConnected = computed(() => state.value.status === 'connected');
    const isDisconnected = computed(() => state.value.status === 'disconnected');

    const connect = (params?: Record<string, unknown>): Promise<SessionState> =>
      store ? store.connect(params) : Promise.resolve(DISCONNECTED);
    const disconnect = (): Promise<void> => (store ? store.disconnect() : Promise.resolve());
    const restore = (): Promise<SessionState> =>
      store ? store.restore() : Promise.resolve(DISCONNECTED);

    // Pinia setup stores must RETURN all state + actions to track them.
    return {
      status,
      account,
      accounts,
      networkId,
      lastError,
      party,
      isConnected,
      isDisconnected,
      connect,
      disconnect,
      restore,
    };
  });
}

/** The store instance type returned by the `useStore` from {@link definePartyLayerStore}. */
export type PartyLayerStore = ReturnType<ReturnType<typeof definePartyLayerStore>>;
