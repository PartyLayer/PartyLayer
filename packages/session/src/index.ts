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
 * package. It stays in the 0.x range until the M1 cut, where changesets
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
