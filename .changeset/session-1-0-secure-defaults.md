---
"@partylayer/session": major
---

1.0 — secure session persistence by default.

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
