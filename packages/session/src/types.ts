/**
 * Public types for the framework-agnostic session core.
 */

import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import type { SessionStorage } from './storage';

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
}

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
  /** Tear down: remove all provider listeners and internal subscribers. */
  destroy(): void;
}
