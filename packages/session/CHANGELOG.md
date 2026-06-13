# @partylayer/session

## 1.0.2

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 1.0.1

### Patch Changes

- d228933: Sessions now persist immediately on connect (previously only after the first reload or a party/network switch).

  The encrypted session snapshot is written the moment the store first holds both a connected status and a primary account — covering connects the store observes via provider events (`statusChanged`/`accountsChanged`), not just connects made through its own `connect()` or recovered on restore. A session is no longer lost if the tab closes before the first reload. Idempotent: replayed connect events do not re-persist, and the restore and party/network-switch persist paths are unchanged.

## 1.0.0

### Major Changes

- 767b694: 1.0 — secure session persistence by default.

  `@partylayer/session` is the framework-agnostic session core for Canton dApps.
  This release makes secure persistence the default and marks the API stable:
  - **Secure by default.** With no `storage` configured, sessions persist to
    encrypted IndexedDB (AES-GCM-256, non-extractable origin-bound key) where the
    platform supports it, falling back to in-memory otherwise; `persistSnapshot`
    defaults to `true`. Opt out with `persistSnapshot: false` or
    `storage: createMemoryStorage()`. An explicit `storage` is always respected.
  - **Encrypted persistence** — two `SessionStorage` backends (IndexedDB and
    localStorage-blob), versioned session envelope, and a schema-migration scaffold;
    restore is fail-safe (corrupt / wrong-key / unknown-version / expired ⇒ null +
    cleared, never throws).
  - **Resilience** — automatic reconnect with exponential backoff on transient
    disconnects, runtime expiry → graceful re-auth with a bounded operation queue.
  - **Multi-tab sync** — origin-bound BroadcastChannel; a disconnect (and session
    updates) propagate across tabs, with a graceful no-op where unavailable.
  - **Party-switch & network-change detection** — structured `party:changed` /
    `network:changed` events plus an invalidation hook.
  - **Origin isolation** — all persisted key/blob namespaces are origin-scoped.

  BREAKING: the default persisted value changed from a plain marker to an encrypted
  snapshot, and the default storage changed from in-memory to encrypted IndexedDB
  (browser). Memory/marker behavior remains available via the opt-outs above.

### Minor Changes

- 60d2205: Encrypted session persistence core. Adds two
  ADDITIVE `SessionStorage` backends — `createEncryptedIndexedDBStorage` (default)
  and `createEncryptedLocalStorage` — that encrypt the persisted session at rest
  with AES-GCM-256. The key is always generated non-extractable and always stored
  in IndexedDB (only the ciphertext blob location varies); a fresh 12-byte IV per
  write; origin-bound key/DB/blob naming. Adds a versioned session envelope
  (`encodeSessionEnvelope`/`decodeSessionEnvelope` + `migrateSessionEnvelope`
  switch-on-version scaffold), `restoreSession` (corrupt/wrong-key/unknown-version/
  expired ⇒ null + cleared, never throws), and `reconcileSession` (structured diff
  of restored snapshot vs live wallet status). Honest threat model documented:
  protects at-rest data + casual inspection; does NOT defend same-origin XSS.
- ae3e889: Session resilience. ADDITIVE, opt-in.
  - **Automatic reconnect** with exponential backoff (`RetryPolicy { baseDelayMs,
factor, maxDelayMs, maxAttempts, jitter? }`, sane defaults; `reconnect` option
    `RetryPolicy | false`). Fires ONLY on transient provider-driven disconnects;
    NEVER after an explicit `store.disconnect()`. Structured events via the new
    `store.on(...)`: `reconnect:scheduled` / `:attempt` / `:succeeded` / `:gaveup`.
  - **Runtime expiry → graceful re-auth**: `expiry.ttlMs` arms a timer; on expiry
    the store emits `session:expired` and invokes `onReauthRequired`. New ops via
    the new `store.enqueue(op)` are held in a bounded queue (`pendingQueueSize`,
    default 32) — resumed on re-auth success, rejected on failure/overflow.
  - Honest limit (documented): preserves queued intent + session context across
    re-auth; does NOT resurrect a tx already inside the wallet.

  New exports: `RetryPolicy`, `DEFAULT_RETRY_POLICY`, `computeBackoffDelay`,
  `SessionEvent`, `ExpiryOptions`, `ReauthContext`; `SessionStore` gains `on` +
  `enqueue`; `SessionStoreOptions` gains `reconnect` + `expiry`.

- 63a9ac5: Multi-tab sync + party-switch + network-change invalidation. ADDITIVE, opt-in.
  - **Multi-tab** via BroadcastChannel (`broadcast` option; origin-bound channel
    using the origin-bound originTag pattern; injectable `channelFactory`). Disconnect in one
    tab propagates to all tabs; a receiving tab applies WITHOUT rebroadcasting
    (loop-safe). Graceful no-op when BroadcastChannel is unavailable (SSR/Node).
  - **Party-switch**: `accountsChanged` primary-partyId delta → `party:changed`
    event + `onInvalidate` hook + (with `persistSnapshot`) snapshot rewrite. A list
    reorder keeping the same primary is NOT a switch.
  - **Network change**: `statusChanged.network`/`chainChanged` networkId delta →
    `network:changed` + `onInvalidate` + snapshot rewrite.
  - **`persistSnapshot`** option: persist the full session envelope (rewritten on
    party/network change) instead of the legacy '1' marker (default off).

  New exports: `InvalidationEvent`, `openSyncChannel`, `defaultChannelFactory`,
  `BroadcastOptions`, `BroadcastChannelLike`, `BroadcastEnvelope`, `ChannelFactory`,
  `SyncChannel`; `SessionEvent` gains `party:changed` + `network:changed`;
  `SessionStoreOptions` gains `broadcast` + `persistSnapshot` + `onInvalidate`.

## 0.2.1

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.2.0

### Minor Changes

- c18a275: Make `@partylayer/session` a published (non-private) package — its initial
  public release in the 0.x range.

  It is a real, framework-agnostic package consumed by `@partylayer/react` (via
  `workspace:^`) for the `useAccount` / `useAccountEffect` hooks, and a Vue layer
  will consume it later. No runtime/logic or public-API changes — only the
  `private` flag is removed so publish-coherence validation and the regression
  gate treat it as a first-class published `@partylayer/*` package. changesets
  releases it ahead of `@partylayer/react`, so the two ship together at the M1
  cut with no ordering hazard.

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0
