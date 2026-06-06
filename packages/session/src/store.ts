/**
 * Framework-agnostic session store over a CIP-0103 provider.
 *
 * Wraps any `CIP0103Provider` (the real `PartyLayerProvider`, the bridge, or
 * the `@partylayer/testing` mock) and tracks connection status + the active
 * account by subscribing to the SAME events the provider emits
 * (`statusChanged`, `accountsChanged`). Exposes a `subscribe`/`getSnapshot`
 * surface designed for React `useSyncExternalStore` (Step 6b) and Vue
 * composables — but contains no React/Vue/DOM code.
 */

import {
  CIP0103_EVENTS,
  type CIP0103Account,
  type CIP0103EventListener,
  type CIP0103Network,
  type CIP0103Provider,
  type CIP0103StatusEvent,
} from '@partylayer/core';
import { createMemoryStorage, type SessionStorage } from './storage';
import type {
  SessionAccount,
  SessionState,
  SessionStore,
  SessionStoreOptions,
} from './types';

const DEFAULT_STORAGE_KEY = 'partylayer.session.connected';

const INITIAL_STATE: SessionState = {
  status: 'disconnected',
  account: null,
  accounts: [],
  networkId: null,
  lastError: null,
};

type MutableState = {
  -readonly [K in keyof SessionState]: SessionState[K];
};

function pickPrimary(accounts: readonly SessionAccount[]): SessionAccount | null {
  return accounts.find((a) => a.primary) ?? accounts[0] ?? null;
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Session operation failed');
}

/** Shallow equality over the snapshot fields (accounts compared by reference). */
function statesEqual(a: SessionState, b: SessionState): boolean {
  return (
    a.status === b.status &&
    a.account === b.account &&
    a.accounts === b.accounts &&
    a.networkId === b.networkId &&
    a.lastError === b.lastError
  );
}

export function createSessionStore(
  provider: CIP0103Provider,
  options: SessionStoreOptions = {},
): SessionStore {
  const storage: SessionStorage = options.storage ?? createMemoryStorage();
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  let state: SessionState = INITIAL_STATE;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A faulty subscriber must not break the others or the store.
      }
    }
  }

  /** Replace state only on real change (keeps getSnapshot reference stable). */
  function setState(patch: Partial<MutableState>): void {
    const next: SessionState = { ...state, ...patch };
    if (statesEqual(state, next)) return;
    state = next;
    notify();
  }

  async function persistConnected(): Promise<void> {
    try {
      await storage.setItem(storageKey, '1');
    } catch {
      // Persistence is best-effort; never block the session on storage errors.
    }
  }

  async function clearConnected(): Promise<void> {
    try {
      await storage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  // ── Provider event wiring ──────────────────────────────────────────────────

  const onStatusChanged: CIP0103EventListener = (...args: unknown[]) => {
    const evt = args[0] as CIP0103StatusEvent | undefined;
    const connected = evt?.connection?.isConnected === true;
    if (connected) {
      setState({
        status: 'connected',
        networkId: evt?.network?.networkId ?? state.networkId,
        lastError: null,
      });
    } else {
      setState({
        status: 'disconnected',
        account: null,
        accounts: [],
        networkId: null,
      });
    }
  };

  const onAccountsChanged: CIP0103EventListener = (...args: unknown[]) => {
    const incoming = args[0];
    const accounts: SessionAccount[] = Array.isArray(incoming)
      ? (incoming as CIP0103Account[])
      : [];
    setState({ accounts, account: pickPrimary(accounts) });
  };

  // Network changes: today derived from `statusChanged.network` (the WC adapter
  // does not emit `chainChanged` yet). We ALSO subscribe to a forward-compat
  // `chainChanged` event so that when a provider starts emitting it, network
  // updates flow through the same field with no further changes here.
  const onChainChanged: CIP0103EventListener = (...args: unknown[]) => {
    const net = args[0] as CIP0103Network | undefined;
    if (net?.networkId) setState({ networkId: net.networkId });
  };

  provider.on(CIP0103_EVENTS.STATUS_CHANGED, onStatusChanged);
  provider.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, onAccountsChanged);
  provider.on('chainChanged', onChainChanged);

  // ── Public store ───────────────────────────────────────────────────────────

  const store: SessionStore = {
    getSnapshot() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async connect(params) {
      setState({ status: 'connecting', lastError: null });
      try {
        await provider.request({ method: 'connect', params });
        // statusChanged + accountsChanged (emitted during connect) have
        // normally already moved us to 'connected'; assert it defensively in
        // case a provider does not emit on connect.
        if (state.status !== 'connected') setState({ status: 'connected' });
        await persistConnected();
        return state;
      } catch (err) {
        // Surface as lastError without crashing the caller (e.g. user rejected).
        setState({
          status: 'disconnected',
          account: null,
          accounts: [],
          lastError: toError(err),
        });
        return state;
      }
    },

    async disconnect() {
      try {
        await provider.request({ method: 'disconnect' });
      } catch (err) {
        setState({ lastError: toError(err) });
      } finally {
        setState({
          status: 'disconnected',
          account: null,
          accounts: [],
          networkId: null,
        });
        await clearConnected();
      }
    },

    async restore() {
      setState({ status: 'reconnecting', lastError: null });
      try {
        const hadMarker = (await storage.getItem(storageKey)) !== null;
        const status = await provider.request<CIP0103StatusEvent>({
          method: 'status',
        });
        const connected = status?.connection?.isConnected === true;

        if (connected) {
          let accounts: SessionAccount[] = [];
          try {
            accounts = await provider.request<CIP0103Account[]>({
              method: 'listAccounts',
            });
          } catch {
            accounts = [];
          }
          setState({
            status: 'connected',
            accounts,
            account: pickPrimary(accounts),
            networkId: status?.network?.networkId ?? null,
            lastError: null,
          });
          await persistConnected();
        } else {
          setState({
            status: 'disconnected',
            account: null,
            accounts: [],
            networkId: null,
          });
          if (hadMarker) await clearConnected();
        }

        // pass 2: TanStack Query cache wiring attaches here — seed/invalidate
        // query caches keyed by the restored account/network. Do NOT build it
        // in 6a.

        return state;
      } catch (err) {
        setState({ status: 'disconnected', lastError: toError(err) });
        return state;
      }
    },

    init() {
      return this.restore();
    },

    getProvider() {
      return provider;
    },

    destroy() {
      provider.removeListener(CIP0103_EVENTS.STATUS_CHANGED, onStatusChanged);
      provider.removeListener(CIP0103_EVENTS.ACCOUNTS_CHANGED, onAccountsChanged);
      provider.removeListener('chainChanged', onChainChanged);
      listeners.clear();
    },
  };

  return store;
}
