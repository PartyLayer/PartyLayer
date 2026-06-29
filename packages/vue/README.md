# @partylayer/vue

Vue 3 composables and components for PartyLayer, with API parity to
[`@partylayer/react`](../react). Reactive session state via the framework-agnostic
[`@partylayer/session`](../session) store, and a TanStack
[vue-query](https://tanstack.com/query) cache model for the data composables (cost and
DAML), mirroring how the React package uses react-query.

## Install

```bash
npm install @partylayer/vue @partylayer/session vue @tanstack/vue-query
# optional, only for the Pinia integration:
npm install pinia
```

Peers: `vue` (>=3.4), `@tanstack/vue-query` (>=5), and `pinia` (>=2, optional).

## Setup

Provide the session store near the root, and set up `VueQueryPlugin` (the QueryClient),
the Vue analog of React's `QueryClientProvider`. The session store is for the wallet
connection; vue-query is the cache for the cost and DAML composables.

```ts
// main.ts
import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPartyLayerSession } from '@partylayer/vue';
import App from './App.vue';

createApp(App)
  .use(VueQueryPlugin)
  .use(createPartyLayerSession({ provider /* any CIP0103Provider */, persistSnapshot: true }))
  .mount('#app');
```

You can also provide the store from a root `setup()` with `provideSessionStore(config)`
instead of the plugin. `config` is either a pre-built `SessionStore` or
`{ provider: CIP0103Provider } & SessionStoreOptions`.

## Composables

### Reactive session state

Every field is a `ComputedRef` (read `.value`, or auto-unwrap in templates);
destructuring keeps reactivity.

```vue
<script setup lang="ts">
import { useSession, useAccount, usePartyState } from '@partylayer/vue';

const { status, account, networkId, isConnected, connect, disconnect, on } = useSession();
const { party, address, chain } = useAccount();   // wagmi-style account view
const { party: activeParty } = usePartyState();    // party-focused subset
</script>
```

- `useSession()`: reactive `SessionState` (`status`, `account`, `accounts`,
  `networkId`, `lastError`, plus `isConnected`/`isConnecting`/`isReconnecting`/
  `isDisconnected`) and the actions `connect` / `disconnect` / `restore` and the
  narrowed event subscription `on(event, handler)`.
- `useAccount()`: the wagmi-style account view (`party`, `address`, `account`,
  `accounts`, `status`, `chain`, the connection booleans, `networkId`, `lastError`).
- `usePartyState()`: the party-focused subset (`party`, `account`, `accounts`, `status`,
  `isConnected`, `isDisconnected`, `networkId`, `lastError`).
- `useAccountEffect({ onConnect, onDisconnect, onPartyChanged })`: fire-and-forget side
  effects on session transitions; auto-cleans on scope teardown.

### CIP-0104 cost (Model 2)

The dApp supplies the fetcher; the composable wraps it in vue-query. `input` is a
`MaybeRefOrGetter` (a reactive input refetches), and the alias is a `ComputedRef`.

```ts
import { useTransactionCostEstimate, usePaidTrafficCost } from '@partylayer/vue';

const { costEstimate } = useTransactionCostEstimate({ estimate: fetchEstimate, input: txRef });
const { paidTrafficCost } = usePaidTrafficCost({ fetch: fetchPaid, input: txRef });
```

- `useTransactionCostEstimate`: the pre-submission `CostEstimation`.
- `usePaidTrafficCost`: the post-execution `paidTrafficCost`.
- `null` is a valid resolved value (cost absent), not an error.

### DAML read and write (Model 2, generic, schema-agnostic)

```ts
import { useDamlContract, useChoice } from '@partylayer/vue';

// read: generic over T, opaque reactive key, null-is-valid
const { contract } = useDamlContract<MyContract>({ read: fetchContract, key: tmplRef });

// write: generic over result/variables, exerciseChoice/exerciseChoiceAsync aliases
const { exerciseChoice, exerciseChoiceAsync } = useChoice<MyResult, MyVars>({ exercise });
```

PartyLayer does not own ledger transport: you supply the `read` / `exercise` fetcher,
and the composable wraps it in vue-query's `useQuery` / `useMutation`.

## Components

Presentational, prop-driven (no composable calls; the consumer owns the state). Authored
with `defineComponent`, styleable via `class`/`style` fallthrough.

- `CostPreview`: renders a `CostEstimation` and/or a paid cost (CIP-0104). Raw int64 by
  default; pass `formatCost` to format.
- `PartyAvatar`: a deterministic avatar derived purely from the party id.
- `SynchronizerSwitcher`: a select over consumer-provided synchronizers; emits `switch`.
- `TransactionToast`: a status toast (pending/success/error) driven by props.

## Features

- Suspense-ready: the query composables expose `suspense()` for use in an `async setup()`
  inside `<Suspense>`. See [docs/vue-suspense.md](../../docs/vue-suspense.md).
- Optional Pinia integration: a centralized store wrapping the same session store, on the
  `@partylayer/vue/pinia` subpath. See [docs/vue-pinia.md](../../docs/vue-pinia.md).
- Nuxt 3 SSR: the package is SSR-safe, with server-side fetching of query data via
  `onServerPrefetch` + `suspense()` and dehydrate/hydrate. See
  [docs/vue-nuxt-ssr.md](../../docs/vue-nuxt-ssr.md).

## Provisioning details

- `provideSessionStore(config)`: the core; call in a `setup()`.
- `createPartyLayerSession(config)`: a thin Vue plugin (`app.use(...)`) over the same
  provide (single source of truth).

Ownership rule: when built from config, this layer owns the lifecycle. `init()` runs
client-only (on mount), `destroy()` on scope/app teardown. A pre-built store's lifecycle
belongs to you; it is never `init()`/`destroy()`d here.

SSR-safe: the store is constructed without DOM access and `init()` is deferred to the
client; with no provided store, the composables report a disconnected session and the
actions are no-ops.

## React and Vue parity (deviations flagged)

| `@partylayer/react` | `@partylayer/vue` | Deviation |
|---|---|---|
| hooks return plain values | composables return `ComputedRef` | access `.value` (or auto-unwrap in templates); destructuring keeps reactivity |
| `useSuspenseQuery` hooks | `useQuery().suspense()` | Vue has no separate suspense composable; `await suspense()` in `async setup()` |
| `<PartyLayerProvider>` / `<PartyLayerKit>` | `provideSessionStore()` / `createPartyLayerSession()` plugin | Vue uses provide-inject / a plugin, not a wrapper component |
| `useClientSession()` (legacy SDK getter) | not ported | Vue has no legacy SDK-session layer |

The shared `partyLayerKeys` factory (exported from `@partylayer/vue`) produces the same
hierarchical cache keys as React, so the two packages stay consistent.
