/**
 * Public types for the framework-agnostic session core.
 */

import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import type { SessionStorage } from './storage';
import type { RetryPolicy } from './retry';
import type { BroadcastOptions } from './broadcast';

/**
 * Connection status state machine.
 *
 * Derived from what the CIP-0103 provider actually exposes (a boolean
 * `connection.isConnected` on `statusChanged`, plus the `connected` event)
 * combined with the in-flight state of the store's own async operations:
 *
 *   disconnected ──connect()──▶ connecting ──success / statusChanged(true)──▶ connected
 *        ▲                          │                                            │
 *        │                          └────── error / rejection ──────────────────┤
 *        │                                                                       │
 *        ├───────────── disconnect() / statusChanged(false) ────────────────────┘
 *        │
 *        └──restore()/init()──▶ reconnecting ──active session──▶ connected
 *                                     └────── none ──▶ disconnected
 */
export type SessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

/**
 * An account/party tracked by the session. This is the CIP-0103 account shape
 * verbatim — the core does not invent its own account model.
 */
export type SessionAccount = CIP0103Account;

/**
 * Immutable snapshot of session state. `getSnapshot()` returns a STABLE
 * reference between notifications (only swapped when something actually
 * changed) so it is safe to feed directly into React's `useSyncExternalStore`
 * in Step 6b without tearing or render loops.
 */
export interface SessionState {
  /** Connection status state-machine value. */
  readonly status: SessionStatus;
  /** Active (primary) account/party, or null when not connected. */
  readonly account: SessionAccount | null;
  /** All accounts the wallet exposed (active included). */
  readonly accounts: readonly SessionAccount[];
  /**
   * Active network in CAIP-2 form, or null. Today this is derived from
   * `statusChanged.network` / `getActiveNetwork()` because the WC adapter does
   * not emit `chainChanged` yet (see store wiring). Modeled forward-compatibly
   * so a future `chainChanged` event can feed the same field.
   */
  readonly networkId: string | null;
  /** Last error from a connect/restore/disconnect attempt, or null. */
  readonly lastError: Error | null;
}

export interface SessionStoreOptions {
  /**
   * Pluggable persistence. Defaults to in-memory storage (no DOM access).
   * Inject a `localStorage`-backed adapter from the browser framework layer.
   */
  storage?: SessionStorage;
  /** Storage key used for the auto-reconnect marker. */
  storageKey?: string;
  /**
   * M1-S2: automatic reconnect with exponential backoff on TRANSIENT disconnects
   * (a `statusChanged(isConnected:false)` that was NOT an explicit
   * `store.disconnect()`). A `RetryPolicy` enables it; `false` disables it;
   * omitted ⇒ the default policy (enabled). NEVER fires after a user disconnect.
   */
  reconnect?: RetryPolicy | false;
  /**
   * M1-S2: runtime session-expiry → graceful re-auth. When `ttlMs` is set, an
   * active session arms a timer; on expiry the store emits `session:expired` and
   * invokes `onReauthRequired`. New operations submitted through
   * {@link SessionStore.enqueue} during re-auth are held in a bounded queue
   * (`pendingQueueSize`, default 32), resumed on success or rejected on
   * failure/overflow.
   */
  expiry?: ExpiryOptions;
  /**
   * M1-S3: multi-tab sync via BroadcastChannel. `true` enables it with the
   * default (global) channel; an object customizes the channel factory (tests
   * inject an in-memory hub). Omitted/`false` ⇒ disabled (single-tab). Graceful
   * no-op when BroadcastChannel is unavailable (SSR / Node). Origin-bound.
   */
  broadcast?: boolean | BroadcastOptions;
  /**
   * M1-S3: persist the FULL session snapshot (S1 envelope) at `storageKey`,
   * rewriting it on party/network change, instead of the legacy `'1'` marker.
   * Default `false` (legacy marker behavior preserved — additive).
   */
  persistSnapshot?: boolean;
  /**
   * M1-S3: invalidation hook called on a party-switch or network change — the
   * point where consumer cache invalidation (React-Query) wires in at S4/S6.
   * The session layer only emits + invalidates here.
   */
  onInvalidate?: (event: InvalidationEvent) => void | Promise<void>;
}

/** M1-S3 invalidation payload (party-switch or network change). */
export interface InvalidationEvent {
  readonly type: 'party:changed' | 'network:changed';
  readonly previous: string | null;
  readonly current: string | null;
}

/** M1-S2 expiry / graceful re-auth configuration. */
export interface ExpiryOptions {
  /** Time-to-live (ms from connect/restore) after which the session expires at runtime. */
  ttlMs?: number;
  /**
   * App-supplied re-auth hook invoked on runtime expiry. Perform a fresh connect
   * here; resolve to resume queued operations, reject to drain-reject them.
   */
  onReauthRequired?: (ctx: ReauthContext) => Promise<void> | void;
  /** Max operations held in the pending queue during re-auth. Default 32. */
  pendingQueueSize?: number;
}

/** Context passed to {@link ExpiryOptions.onReauthRequired}. */
export interface ReauthContext {
  readonly reason: 'expired';
  /** Epoch-ms at which expiry fired. */
  readonly expiredAt: number;
}

/**
 * Structured resilience events (M1-S2). Subscribe via {@link SessionStore.on}.
 * `delayMs`/`attempt` let UIs surface backoff progress; `attempt` is 1-based.
 */
export type SessionEvent =
  | { readonly type: 'reconnect:scheduled'; readonly attempt: number; readonly delayMs: number }
  | { readonly type: 'reconnect:attempt'; readonly attempt: number }
  | { readonly type: 'reconnect:succeeded'; readonly attempt: number }
  | { readonly type: 'reconnect:gaveup'; readonly attempts: number; readonly lastError: Error | null }
  | { readonly type: 'session:expired'; readonly expiredAt: number }
  // M1-S3 — multi-tab / party-switch / network-change.
  | { readonly type: 'party:changed'; readonly previous: string | null; readonly current: string | null }
  | { readonly type: 'network:changed'; readonly previous: string | null; readonly current: string | null };

/**
 * Framework-agnostic session manager. Subscribable for `useSyncExternalStore`
 * (6b) and Vue composables; contains no React/Vue/DOM code.
 */
export interface SessionStore {
  /** Current immutable snapshot (stable reference between changes). */
  getSnapshot(): SessionState;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Connect via the provider's CIP-0103 `connect` method. */
  connect(params?: Record<string, unknown>): Promise<SessionState>;
  /** Disconnect via the provider's CIP-0103 `disconnect` method. */
  disconnect(): Promise<void>;
  /**
   * Restore/initialize: rehydrate state from the live provider (`status` +
   * accounts) and the persisted auto-reconnect marker. The framework layer
   * (6b) calls this on mount; the dapp-sdk DiscoveryClient.create restore path
   * plugs in here.
   */
  restore(): Promise<SessionState>;
  /** Alias for `restore()`, named for the framework mount lifecycle. */
  init(): Promise<SessionState>;
  /** The underlying CIP-0103 provider. */
  getProvider(): CIP0103Provider;
  /**
   * M1-S2: subscribe to structured resilience events (reconnect lifecycle +
   * session expiry). Returns an unsubscribe function. Distinct from
   * {@link subscribe} (which is the state-change notifier for
   * `useSyncExternalStore`).
   */
  on(event: SessionEvent['type'], handler: (event: SessionEvent) => void): () => void;
  /**
   * M1-S2: run an operation, queuing it (bounded) if a re-auth is in progress —
   * resumed after re-auth succeeds, rejected on overflow or re-auth failure.
   * When no re-auth is in progress it runs immediately. Preserves QUEUED intent
   * + session context across re-auth; a tx already inside the wallet cannot be
   * resurrected (explicit limit — see README).
   */
  enqueue<T>(op: () => Promise<T>): Promise<T>;
  /** Tear down: remove all provider listeners and internal subscribers. */
  destroy(): void;
}
