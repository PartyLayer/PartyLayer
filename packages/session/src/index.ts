/**
 * @partylayer/session — Step 6a (framework-agnostic core)
 *
 * The wagmi-core-equivalent for Canton: a framework-agnostic session manager
 * over the CIP-0103 provider abstraction. Tracks connection status and the
 * active account/party, reacts to `statusChanged` / `accountsChanged`,
 * supports restore/reconnect, and exposes a subscribable store
 * (`subscribe` + `getSnapshot`) for `useSyncExternalStore` (Step 6b) and Vue
 * composables.
 *
 * This is a published (non-private) package: `@partylayer/react` depends on it
 * via `workspace:^` for its `useAccount` / `useAccountEffect` hooks (Step 6b),
 * and a Vue layer will consume it later. Its public surface is tracked by the
 * regression-gate API snapshot like every other published `@partylayer/*`
 * package. It stays in the 0.x range until the 1.0 cut, where changesets
 * releases it ahead of `@partylayer/react`.
 *
 * Framework layers (React in `@partylayer/react`, Vue later) consume this core;
 * keep this package framework-agnostic — do NOT add React/Vue/DOM code here.
 */

export { createSessionStore } from './store';
export {
  createMemoryStorage,
  type SessionStorage,
  type MaybePromise,
} from './storage';
export type {
  SessionStatus,
  SessionAccount,
  SessionState,
  SessionStore,
  SessionStoreOptions,
} from './types';
// Resilience: automatic reconnect (exponential backoff) + runtime expiry
// → graceful re-auth with a bounded pending queue (additive).
export type {
  SessionEvent,
  ExpiryOptions,
  ReauthContext,
} from './types';
export {
  DEFAULT_RETRY_POLICY,
  computeBackoffDelay,
  type RetryPolicy,
} from './retry';
// Multi-tab sync (BroadcastChannel, origin-bound) + party-switch /
// network-change invalidation (additive, opt-in).
export type { InvalidationEvent } from './types';
export {
  openSyncChannel,
  defaultChannelFactory,
  type BroadcastOptions,
  type BroadcastChannelLike,
  type BroadcastEnvelope,
  type ChannelFactory,
  type SyncChannel,
} from './broadcast';
// Encrypted persistence core (additive). Two SessionStorage backends
// (the AES-GCM-256 key is always non-extractable + stored in IndexedDB; only the
// ciphertext blob location varies) plus the versioned session envelope, a
// migration scaffold, and restore/reconcile helpers. See README "Encrypted
// persistence" + the honest threat model.
export {
  createEncryptedIndexedDBStorage,
  createEncryptedLocalStorage,
  type EncryptedStorageOptions,
} from './encrypted-storage';
export {
  encodeSessionEnvelope,
  decodeSessionEnvelope,
  migrateSessionEnvelope,
  restoreSession,
  reconcileSession,
  CURRENT_SESSION_ENVELOPE_VERSION,
  type PersistedSessionSnapshot,
  type LiveSessionStatus,
  type SessionDiff,
  type ReconcileResult,
} from './session-envelope';
