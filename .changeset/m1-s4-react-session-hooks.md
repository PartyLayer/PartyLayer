---
"@partylayer/react": minor
---

Reactive session hooks + demo wiring.

- NEW `useSession()` — reactive `SessionState` + bound actions
  (`connect`/`disconnect`/`restore`) + the narrowed `on(event, handler)` for
  resilience/sync events. Backed by `@partylayer/session` via context. SSR-safe.
- `useAccountEffect` gains `onPartyChanged({ previous, current })` (the
  `party:changed` switch event).
- `PartyLayerProvider`/`PartyLayerKit` gain `sessionOptions?: Partial<SessionStoreOptions>`
  (forward reconnect/expiry/broadcast/persistSnapshot/storage to the store).
- apps/demo (private) adopts the session layer on the apex: encrypted IndexedDB
  persistence + persistSnapshot + default reconnect + multi-tab + a live
  `<SessionIndicator>`.

⚠️ BREAKING: `useSession`'s return type changed from the SDK-layer session
getter (`Session | null`) to `UseSessionReturn` (reactive state + actions). The
legacy getter is preserved VERBATIM as **`useClientSession()`** —
migration: `useSession()` → `useClientSession()`.
