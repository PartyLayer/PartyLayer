---
"@partylayer/session": minor
---

M1-S2: session resilience (grant Milestone 1, slice 2). ADDITIVE, opt-in.

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
