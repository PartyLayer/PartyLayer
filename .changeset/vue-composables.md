---
"@partylayer/vue": minor
---

New package: Vue 3 composables for PartyLayer sessions.

Thin reactive bindings over `@partylayer/session`, mirroring `@partylayer/react`:

- `useSession()` — reactive session state (`status`/`account`/`accounts`/
  `networkId`/`lastError` + `isConnected`/`isConnecting`/`isReconnecting`/
  `isDisconnected`) and actions (`connect`/`disconnect`/`restore`/`on`), returned
  as Vue refs (destructuring keeps reactivity).
- `useAccount()` — reactive `{ party, address, account, accounts, status,
  networkId, chain, … }`.
- `useAccountEffect({ onConnect, onDisconnect, onPartyChanged })` — transition
  side-effects, auto-cleaned on scope teardown.
- `provideSessionStore(config)` + a thin `createPartyLayerSession()` plugin over
  the same provide. Accepts a pre-built store or `{ provider } & options`; when
  built from config the layer owns the lifecycle (client-only `init()`,
  `destroy()` on teardown), a pre-built store is left to the caller. SSR-safe.
