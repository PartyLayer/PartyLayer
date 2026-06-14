# @partylayer/vue

## 0.1.3

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0
  - @partylayer/session@1.0.4

## 0.1.2

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0
  - @partylayer/session@1.0.3

## 0.1.1

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0
  - @partylayer/session@1.0.2

## 0.1.0

### Minor Changes

- 55310e7: New package: Vue 3 composables for PartyLayer sessions.

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

### Patch Changes

- Updated dependencies [60d2205]
- Updated dependencies [ae3e889]
- Updated dependencies [63a9ac5]
- Updated dependencies [767b694]
  - @partylayer/session@1.0.0
