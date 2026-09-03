# @partylayer/vue

## 2.0.0

### Major Changes

- 9e8ca31: **Breaking, and one value changes meaning rather than merely appearing.**

  **`transactionHash` is now optional**, so an adapter with no honest value omits it. If you read `receipt.transactionHash` or `signed.transactionHash`, you must handle `undefined`.

  **On Loop, `receipt.updateId` has changed meaning.** It previously held `submission_id ?? command_id` — a submission id identifies the request, not the committed update. It now holds the Loop SDK's real `update_id`, and is **omitted when that is absent**. So a consumer reading `receipt.updateId` on Loop who previously always got a string may now get `undefined`, and the string they got before did not mean what its name said. This is a value quietly changing meaning, not a field appearing, so it will not show up as a type error at the point that matters.

  **Grep your own code for `String(receipt.transactionHash)`.** Now that the field is optional, that renders the literal text `"undefined"` — it compiles, it is not a type error, and it reaches your UI looking like ordinary output. Template interpolation (`` `${receipt.transactionHash}` ``) and string concatenation do the same. Three such sites existed inside this repository and are fixed here; yours are yours to find.

  ## Why this is breaking, by the rules

  `docs/releasing.md` lists "Changing method signatures (parameters, return types)" as a breaking change. `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` go from `TransactionHash` to `TransactionHash | undefined`, so every consumer reading them must now handle absence. It is a breaking change and is described as one here.

  `@partylayer/react` (2 → 3) and `@partylayer/vue` (1 → 2) take major bumps for it. `@partylayer/core`, `@partylayer/sdk` and `@partylayer/provider` are pre-1.0 and take minor bumps: a jump to 1.0.0 would announce a stability commitment this change does not warrant, and 0.x already sets the expectation that a minor can break. Read the change, not the number.

  Also optional, for the same reason and from the same source: `TxStatusUpdate.txId` (core) and `TxStatusEvent.txId` (sdk).

  ## Who is affected

  The compiler enumerated this, not a grep. Every site that had to change:
  - `@partylayer/sdk` — the three `tx:status` emissions in `client.ts` (sign, submit, transfer)
  - `@partylayer/provider` — `BridgeableClient`'s structural type, and the `signed` / `executed` CIP-0103 payloads
  - `@partylayer/react` and `@partylayer/vue` — the `TransactionToast` detail line

  If you read `receipt.transactionHash`, you now need to handle `undefined`. If you want a ledger identifier, prefer `receipt.updateId`: it is the ledger's own id for the committed update, and several wallets report a real one while having no hash at all.

  **Watch for `String(receipt.transactionHash)`.** That pattern compiles fine and renders the literal text `"undefined"` — a new placeholder created by the very change that removed the old ones. Three such sites existed inside this repository and are fixed here; check yours.

  ## The finding this comes from

  **A required field with no honest value is a defect factory.**

  Nine sites across five adapters manufactured a transaction hash: `tx_<now>_<random>`, `tx_<now>`, `'pending'` (three times), `''`, a command id, a signature. Not one of them was a fallback anybody designed. Every one existed because the type demanded a value the code path could not produce, and the adapter had nowhere to put nothing.

  Two of the nine were found only while making this change — in our Bron adapter, which an earlier survey of this exact problem had missed because they were ternaries rather than `??` chains. That is the argument in miniature: fixing the sites one at a time finds the ones you already know how to look for, and leaving the field required guarantees the next adapter writes a tenth.

  ## Also fixed here
  - **`BronAdapter`** omits `transactionHash` instead of reporting the word `'pending'` as one (two sites).
  - **`LoopAdapter`** omits it instead of reporting the command id under it. The command id is still reported as `commandId`, which is true of it. A real value under a wrong name is the same error as a fabricated one for anyone reading the field by its name.

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0
  - @partylayer/session@1.1.8

## 1.0.4

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0
  - @partylayer/session@1.1.7

## 1.0.3

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1
  - @partylayer/session@1.1.6

## 1.0.2

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0
  - @partylayer/session@1.1.5

## 1.0.1

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0
  - @partylayer/session@1.1.4

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
  - `useSession()`: reactive session state (`status`/`account`/`accounts`/
    `networkId`/`lastError` + `isConnected`/`isConnecting`/`isReconnecting`/
    `isDisconnected`) and actions (`connect`/`disconnect`/`restore`/`on`), returned
    as Vue refs (destructuring keeps reactivity).
  - `useAccount()`: reactive `{ party, address, account, accounts, status,
networkId, chain, … }`.
  - `useAccountEffect({ onConnect, onDisconnect, onPartyChanged })`: transition
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
