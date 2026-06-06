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
 * This package is intentionally `private` for now: the API is still forming
 * and the React hooks land in Step 6b. Keeping it private also keeps it out of
 * the published-API snapshot gate until 6b/stabilization (same rationale as
 * `@partylayer/testing`).
 *
 * Step 6b (SEPARATE PR) adds React hooks (useAccount/useAccountEffect and
 * wires useSession onto this core, backward-compatibly). Do NOT add React here.
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
