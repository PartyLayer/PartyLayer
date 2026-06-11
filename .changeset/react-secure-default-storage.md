---
"@partylayer/react": minor
---

Adopt the session 1.0 secure-by-default storage.

`PartyLayerProvider`/`PartyLayerKit` no longer pin a plain `localStorage` marker
as the default session storage. With no `sessionOptions.storage`, the provider
now inherits the `@partylayer/session` default — encrypted IndexedDB snapshots
where supported, in-memory otherwise.

Behavior change: default session persistence moves from an unencrypted
plain-`localStorage` marker to encrypted IndexedDB snapshots. On mount under the
default storage, the provider makes a best-effort removal of the stale pre-1.0
`localStorage` marker. Apps that explicitly pass `sessionOptions.storage` (e.g.
`createLocalStorage()` or `createMemoryStorage()`) are unaffected.
