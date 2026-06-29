# @partylayer/vue

## 1.0.0

### Major Changes

- 48a98e0: v1.0: the first stable release of the Vue 3 bindings.

  @partylayer/vue v1.0 provides Vue 3 composables and components for PartyLayer, with API
  parity to @partylayer/react. It mirrors React's reactive cache model using TanStack
  vue-query (a peer dependency), so the two packages share the same query/mutation patterns
  and cache keys.

  What v1.0 includes:
  - Reactive session state composables: useSession, useAccount, and usePartyState (each
    field a ComputedRef), plus useAccountEffect for session-transition side effects.
  - CIP-0104 cost composables: useTransactionCostEstimate (pre-submission) and
    usePaidTrafficCost (post-execution), both Model 2 (the dApp supplies the fetcher).
  - DAML read and write composables: useDamlContract (Model 2 read, generic and
    schema-agnostic) and useChoice (Model 2 write).
  - Presentational components: CostPreview (CIP-0104), PartyAvatar, SynchronizerSwitcher,
    and TransactionToast.
  - Suspense-ready query composables (the useQuery suspense function, used in an async
    setup inside Suspense).
  - An optional Pinia integration on the @partylayer/vue/pinia subpath (pinia is an
    optional peer dependency).
  - Nuxt 3 SSR support: the package is SSR-safe, with server-side fetching of query data
    via onServerPrefetch and the suspense function plus dehydrate and hydrate.
  - CIP-0103 conformance validated against the shared conformance runner.

  The session bindings (provide-inject and the composables) remain the default; the
  QueryClient is supplied by the consumer via VueQueryPlugin, the Vue analog of React's
  QueryClientProvider. See the package README and the docs/vue-suspense, docs/vue-pinia,
  and docs/vue-nuxt-ssr guides.

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0
  - @partylayer/session@1.1.2

## 0.1.4

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0
  - @partylayer/session@1.1.1

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
