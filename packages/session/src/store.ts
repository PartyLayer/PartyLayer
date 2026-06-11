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
import { computeBackoffDelay, type RetryPolicy } from './retry';
import { openSyncChannel, type BroadcastEnvelope, type SyncChannel } from './broadcast';
import { encodeSessionEnvelope, type PersistedSessionSnapshot } from './session-envelope';
import type {
  InvalidationEvent,
  SessionAccount,
  SessionEvent,
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

  // ── resilience config (ADDITIVE; opt-in, preserves legacy behavior) ───
  // reconnect omitted/false ⇒ DISABLED (no behavior change for existing
  // consumers); a RetryPolicy enables exponential-backoff reconnect on TRANSIENT
  // disconnects only.
  const reconnectPolicy: RetryPolicy | null = options.reconnect ? options.reconnect : null;
  const expiry = options.expiry;
  const pendingQueueSize = expiry?.pendingQueueSize ?? 32;

  let state: SessionState = INITIAL_STATE;
  const listeners = new Set<() => void>();

  // Structured resilience event emitter (distinct from the state-change `listeners`).
  const eventListeners = new Map<SessionEvent['type'], Set<(e: SessionEvent) => void>>();
  function emit(event: SessionEvent): void {
    eventListeners.get(event.type)?.forEach((h) => {
      try {
        h(event);
      } catch {
        // a faulty event subscriber must not break the store
      }
    });
  }

  // Distinguishes an EXPLICIT user disconnect (never reconnect) from a transient
  // provider-driven drop (`statusChanged(false)`). Set true only by disconnect().
  let explicitDisconnect = false;

  // Reconnect backoff state.
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let lastReconnectError: Error | null = null;

  function cancelReconnect(): void {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempt = 0;
    lastReconnectError = null;
  }

  // Expiry / graceful re-auth state.
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let reauthInProgress = false;
  const pending: Array<{
    run: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }> = [];

  function disarmExpiry(): void {
    if (expiryTimer != null) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }
  function armExpiry(): void {
    disarmExpiry();
    if (!expiry?.ttlMs || expiry.ttlMs <= 0) return;
    expiryTimer = setTimeout(() => {
      void handleExpiry();
    }, expiry.ttlMs);
  }
  function drainPending(): void {
    const items = pending.splice(0, pending.length);
    for (const it of items) it.run().then(it.resolve, it.reject);
  }
  function rejectPending(cause: Error): void {
    const items = pending.splice(0, pending.length);
    for (const it of items) {
      it.reject(new Error('Session re-authentication failed; queued operation aborted', { cause }));
    }
  }

  // ── multi-tab + party/network invalidation (ADDITIVE; opt-in) ─────────
  const persistSnapshot = options.persistSnapshot === true;
  const onInvalidate = options.onInvalidate;
  let connectedAt = 0; // epoch-ms of the active connect/restore (for the snapshot)
  // RECEIVING-tab loop-prevention: while applying a remote broadcast, suppress
  // re-broadcasting (defensive — applyRemote also bypasses the provider handlers).
  let applyingRemote = false;

  const sync: SyncChannel = options.broadcast
    ? openSyncChannel(storageKey, typeof options.broadcast === 'object' ? options.broadcast : {})
    : { active: false, post() {}, onMessage() {}, close() {} };

  function buildSnapshot(): PersistedSessionSnapshot {
    return {
      account: state.account,
      accounts: state.accounts,
      networkId: state.networkId,
      connectedAt,
    };
  }

  function handlePartyChanged(previous: string | null, current: string | null): void {
    emit({ type: 'party:changed', previous, current });
    void onInvalidate?.({ type: 'party:changed', previous, current } as InvalidationEvent);
    void persistConnected(); // rewrite the persisted snapshot for the new party
    if (!applyingRemote) sync.post({ v: 1, kind: 'party', partyId: current });
  }

  function handleNetworkChanged(previous: string | null, current: string | null): void {
    emit({ type: 'network:changed', previous, current });
    void onInvalidate?.({ type: 'network:changed', previous, current } as InvalidationEvent);
    void persistConnected(); // rewrite the persisted snapshot for the new network
    if (!applyingRemote) sync.post({ v: 1, kind: 'network', networkId: current });
  }

  /** Apply a broadcast from ANOTHER tab WITHOUT rebroadcasting (loop-safe). */
  function applyRemote(env: BroadcastEnvelope): void {
    applyingRemote = true;
    try {
      if (env.kind === 'disconnect') {
        explicitDisconnect = true;
        cancelReconnect();
        disarmExpiry();
        setState({ status: 'disconnected', account: null, accounts: [], networkId: null });
        void clearConnected();
      } else if (env.kind === 'party') {
        const previous = state.account?.partyId ?? null;
        const match = state.accounts.find((a) => a.partyId === env.partyId) ?? null;
        setState({ account: match ?? state.account });
        emit({ type: 'party:changed', previous, current: env.partyId ?? null });
      } else if (env.kind === 'network') {
        const previous = state.networkId;
        setState({ networkId: env.networkId ?? null });
        emit({ type: 'network:changed', previous, current: env.networkId ?? null });
      }
    } finally {
      applyingRemote = false;
    }
  }

  sync.onMessage(applyRemote);

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
      // when snapshot persistence is on, write the full session envelope (and
      // rewrite it on party/network change); otherwise the legacy '1' marker.
      await storage.setItem(storageKey, persistSnapshot ? encodeSessionEnvelope(buildSnapshot()) : '1');
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

  /**
   * WC fallback: WalletConnect never emits `chainChanged` and its `status`
   * event may omit `network`, so after a successful connect/restore the
   * derived `networkId` can be null. When it is, ask the provider directly via
   * `getActiveNetwork`. Guarded — older providers that lack the method (or
   * fail) simply leave `networkId` null.
   */
  async function ensureNetworkId(): Promise<void> {
    if (state.networkId) return;
    try {
      const net = await provider.request<CIP0103Network>({
        method: 'getActiveNetwork',
      });
      if (net?.networkId) setState({ networkId: net.networkId });
    } catch {
      // Provider does not support getActiveNetwork — leave networkId null.
    }
  }

  // ── Provider event wiring ──────────────────────────────────────────────────

  const onStatusChanged: CIP0103EventListener = (...args: unknown[]) => {
    const evt = args[0] as CIP0103StatusEvent | undefined;
    const connected = evt?.connection?.isConnected === true;
    if (connected) {
      const previousNetwork = state.networkId;
      const nextNetwork = evt?.network?.networkId ?? state.networkId;
      setState({ status: 'connected', networkId: nextNetwork, lastError: null });
      // network change: a non-null prior network changed to a new one.
      if (previousNetwork !== null && nextNetwork !== null && previousNetwork !== nextNetwork) {
        handleNetworkChanged(previousNetwork, nextNetwork);
      }
    } else {
      // a TRANSIENT drop is a provider-driven `statusChanged(false)` while
      // we held an active session and the user did NOT call `disconnect()`.
      const wasActive = state.status === 'connected' || state.status === 'reconnecting';
      setState({
        status: 'disconnected',
        account: null,
        accounts: [],
        networkId: null,
      });
      if (reconnectPolicy && !explicitDisconnect && wasActive && reconnectTimer == null) {
        scheduleReconnect();
      }
    }
  };

  const onAccountsChanged: CIP0103EventListener = (...args: unknown[]) => {
    const incoming = args[0];
    const accounts: SessionAccount[] = Array.isArray(incoming)
      ? (incoming as CIP0103Account[])
      : [];
    const previous = state.account?.partyId ?? null;
    setState({ accounts, account: pickPrimary(accounts) });
    const current = state.account?.partyId ?? null;
    // party SWITCH: the PRIMARY partyId changed from a prior non-null value.
    // A list reorder that keeps the same primary is NOT a switch (no event).
    if (previous !== null && previous !== current) {
      handlePartyChanged(previous, current);
    }
  };

  // Network changes: today derived from `statusChanged.network` (the WC adapter
  // does not emit `chainChanged` yet). We ALSO subscribe to a forward-compat
  // `chainChanged` event so that when a provider starts emitting it, network
  // updates flow through the same field with no further changes here.
  const onChainChanged: CIP0103EventListener = (...args: unknown[]) => {
    const net = args[0] as CIP0103Network | undefined;
    if (net?.networkId) {
      const previous = state.networkId;
      setState({ networkId: net.networkId });
      if (previous !== null && previous !== net.networkId) {
        handleNetworkChanged(previous, net.networkId);
      }
    }
  };

  provider.on(CIP0103_EVENTS.STATUS_CHANGED, onStatusChanged);
  provider.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, onAccountsChanged);
  provider.on('chainChanged', onChainChanged);

  // ── reconnect (exponential backoff) ───────────────────────────────────
  // Triggered ONLY by a transient drop (see onStatusChanged). Cancelled by an
  // explicit disconnect or a successful (re)connect. Gives up after maxAttempts.
  function scheduleReconnect(): void {
    if (!reconnectPolicy) return;
    const attempt = reconnectAttempt + 1;
    if (attempt > reconnectPolicy.maxAttempts) {
      emit({ type: 'reconnect:gaveup', attempts: reconnectPolicy.maxAttempts, lastError: lastReconnectError });
      cancelReconnect();
      setState({ status: 'disconnected' }); // terminal
      return;
    }
    reconnectAttempt = attempt;
    const delayMs = computeBackoffDelay(reconnectPolicy, attempt);
    setState({ status: 'reconnecting' });
    emit({ type: 'reconnect:scheduled', attempt, delayMs });
    reconnectTimer = setTimeout(() => {
      void runReconnect(attempt);
    }, delayMs);
  }

  async function runReconnect(attempt: number): Promise<void> {
    reconnectTimer = null;
    if (explicitDisconnect) return; // cancelled while the timer was pending
    emit({ type: 'reconnect:attempt', attempt });
    try {
      const status = await provider.request<CIP0103StatusEvent>({ method: 'status' });
      if (status?.connection?.isConnected === true) {
        let accounts: SessionAccount[] = [];
        try {
          accounts = await provider.request<CIP0103Account[]>({ method: 'listAccounts' });
        } catch {
          accounts = [];
        }
        cancelReconnect();
        setState({
          status: 'connected',
          accounts,
          account: pickPrimary(accounts),
          networkId: status?.network?.networkId ?? state.networkId,
          lastError: null,
        });
        await ensureNetworkId();
        armExpiry();
        emit({ type: 'reconnect:succeeded', attempt });
        return;
      }
      lastReconnectError = new Error('reconnect attempt did not establish a connection');
    } catch (err) {
      lastReconnectError = toError(err);
    }
    if (!explicitDisconnect) scheduleReconnect(); // next attempt / give-up
  }

  // ── runtime expiry → graceful re-auth ─────────────────────────────────
  async function handleExpiry(): Promise<void> {
    expiryTimer = null;
    const expiredAt = new Date().getTime();
    emit({ type: 'session:expired', expiredAt });
    if (!expiry?.onReauthRequired) {
      // No re-auth hook configured → expiry is TERMINAL for this session. Land
      // in 'disconnected' (not 'reconnecting' — there is nothing to reconnect
      // to) with an explanatory error, so the app isn't trapped mid-state.
      setState({ status: 'disconnected', lastError: new Error('Session expired') });
      return;
    }
    // Re-auth hook present → model as re-authenticating while it runs.
    setState({ status: 'reconnecting' });
    reauthInProgress = true;
    try {
      await expiry.onReauthRequired({ reason: 'expired', expiredAt });
      reauthInProgress = false;
      drainPending(); // resume queued intent on the fresh session
      armExpiry(); // re-arm for the new session lifetime
    } catch (err) {
      reauthInProgress = false;
      rejectPending(toError(err));
      setState({ status: 'disconnected', lastError: toError(err) });
    }
  }

  // ── restore/init implementation ─────────────────────────────────────────────
  // Closure-captured so `init()` and `restore()` both delegate here WITHOUT
  // relying on `this` — `const { init } = store; init()` must not crash.
  async function restoreImpl(): Promise<SessionState> {
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
        connectedAt = new Date().getTime(); // stamp for the persisted snapshot
        await ensureNetworkId(); // WC fallback when status omitted network
        await persistConnected();
        armExpiry(); // arm runtime expiry for the restored session
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
  }

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
      // a fresh user-initiated connect clears any prior explicit-disconnect
      // intent and cancels any in-flight reconnect backoff.
      explicitDisconnect = false;
      cancelReconnect();
      setState({ status: 'connecting', lastError: null });
      try {
        await provider.request({ method: 'connect', params });
        // statusChanged + accountsChanged (emitted during connect) have
        // normally already moved us to 'connected'; assert it defensively in
        // case a provider does not emit on connect.
        if (state.status !== 'connected') setState({ status: 'connected' });
        connectedAt = new Date().getTime(); // stamp for the persisted snapshot
        await ensureNetworkId(); // WC fallback when status omitted network
        await persistConnected();
        armExpiry(); // arm the runtime expiry timer for this session
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
      // EXPLICIT user intent — never auto-reconnect after this; cancel any
      // pending backoff + expiry timer.
      explicitDisconnect = true;
      cancelReconnect();
      disarmExpiry();
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
        // propagate the disconnect to all other tabs (the named example).
        if (!applyingRemote) sync.post({ v: 1, kind: 'disconnect' });
      }
    },

    restore() {
      return restoreImpl();
    },

    init() {
      return restoreImpl();
    },

    getProvider() {
      return provider;
    },

    on(eventType, handler) {
      let set = eventListeners.get(eventType);
      if (!set) {
        set = new Set();
        eventListeners.set(eventType, set);
      }
      set.add(handler);
      return () => {
        eventListeners.get(eventType)?.delete(handler);
      };
    },

    async enqueue<T>(op: () => Promise<T>): Promise<T> {
      // No re-auth in flight → run immediately.
      if (!reauthInProgress) return op();
      // Bounded queue: overflow rejects with a clear, actionable error.
      if (pending.length >= pendingQueueSize) {
        throw new Error(
          `Session re-auth in progress: pending queue full (max ${pendingQueueSize})`,
        );
      }
      return new Promise<T>((resolve, reject) => {
        pending.push({
          run: op as () => Promise<unknown>,
          resolve: resolve as (v: unknown) => void,
          reject,
        });
      });
    },

    destroy() {
      provider.removeListener(CIP0103_EVENTS.STATUS_CHANGED, onStatusChanged);
      provider.removeListener(CIP0103_EVENTS.ACCOUNTS_CHANGED, onAccountsChanged);
      provider.removeListener('chainChanged', onChainChanged);
      cancelReconnect();
      disarmExpiry();
      sync.close(); // close the multi-tab channel
      eventListeners.clear();
      listeners.clear();
    },
  };

  return store;
}
