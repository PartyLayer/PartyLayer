# @partylayer/react v1.x to v2.0 migration guide

v2.0 adopts TanStack Query v5 as the reactive cache for the data hooks, adds the
`@partylayer/react/query` entrypoint, and renames the legacy SDK-layer session getter.
The context-based provider and components are unchanged. Most apps need one setup
change (add `QueryClientProvider`) plus a few mechanical renames.

This guide is codemod-friendly: the mappings below are old to new pairs you can apply
with a grep replace or jscodeshift. Each is tagged MECHANICAL (a rename) or SETUP (a
structural change).

## What changed

- The data hooks (wallets, connect, disconnect, sign, submit, cost, DAML) are now
  TanStack Query v5 hooks. `@tanstack/react-query` is a peer dependency, and you supply
  the `QueryClient` via `QueryClientProvider`, the same model wagmi uses.
- A new subpath, `@partylayer/react/query`, exports the query and mutation hooks (and
  the suspense variants). The reactive session/account hooks stay on the main entry.
- The legacy SDK-layer `useSession()` getter is now `useClientSession()`. The name
  `useSession()` on the main entry is the new reactive session hook.
- Backward-compatible aliases (`CantonConnectProvider`, `useCantonConnect`) are
  preserved for one minor cycle.

## Step 1 (SETUP): install the react-query peer and add QueryClientProvider

Install the peer dependency:

```bash
npm install @tanstack/react-query
```

Wrap your app in `QueryClientProvider` (in addition to `PartyLayerProvider`). The
consumer owns the `QueryClient`; PartyLayer does not create one:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerProvider } from '@partylayer/react';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerProvider client={partyLayerClient}>
        <YourApp />
      </PartyLayerProvider>
    </QueryClientProvider>
  );
}
```

## Step 2 (SETUP): import the data hooks from `/query`

The query and mutation hooks live on the `/query` subpath. The reactive session and
account hooks stay on the main entry.

```tsx
// main entry: reactive session/account state, provider, components
import { PartyLayerProvider, useAccount, useSession, usePartyState, CostPreview } from '@partylayer/react';

// /query entry: TanStack query and mutation hooks
import {
  useWallets, useConnect, useDisconnect, useSignMessage, useSubmitTransaction,
  useTransactionCostEstimate, usePaidTrafficCost, useDamlContract, useChoice,
  useSuspenseWallets, useSuspenseTransactionCostEstimate, useSuspensePaidTrafficCost,
} from '@partylayer/react/query';
```

## Step 3 (MECHANICAL): `useSession()` (legacy getter) to `useClientSession()`

The v1 `useSession()` was a plain SDK-layer getter returning the current session. In
v2 that getter is `useClientSession()`, and `useSession()` on the main entry is the new
reactive session hook (reactive `SessionState` plus actions). If your v1 code used
`useSession()` to read the SDK session synchronously, rename it:

```
useSession()  ->  useClientSession()
```

If you instead want reactive session state, keep `useSession()` (new behavior) or use
`usePartyState()` for a party-focused view.

## Backward-compatible aliases (preserved for one minor cycle)

These still work, but the canonical names are preferred. They are MECHANICAL renames
when you are ready:

```
CantonConnectProvider  ->  PartyLayerProvider
useCantonConnect       ->  usePartyLayer
```

## Parity mapping (capability hook names to the real hooks)

| You want | Use | Entry | Notes |
|---|---|---|---|
| Active party state | `usePartyState` | main | reactive party/account state (party, account, status, isConnected) |
| Read a DAML contract | `useDamlContract<T>` | `/query` | Model 2: you supply the read fetcher; generic, schema-agnostic |
| Exercise a DAML choice | `useChoice<R, V>` | `/query` | Model 2: you supply the exercise fetcher; the write counterpart of useDamlContract |
| Transaction cost | `useTransactionCostEstimate` + `usePaidTrafficCost` | `/query` | see below: two precise hooks, not one umbrella |
| A wallet | `useWallets` + `usePartyState` | `/query` + main | see below: the list plus the active party state |

### `useTransactionCost` to two hooks

There is no single `useTransactionCost`. PartyLayer provides two precise hooks, because
a pre-submission estimate and a post-execution actual cost are different fields:

- `useTransactionCostEstimate` reads the pre-submission `CostEstimation` (from the
  prepare step). Use it to show the expected cost before the user submits.
- `usePaidTrafficCost` reads the post-execution `paid_traffic_cost` (from the
  completion). Use it to show the actual cost after a transaction executed.

Both are Model 2: you supply the fetcher; PartyLayer wraps it and types it.

### `useWallet` to `useWallets` + `usePartyState`

There is no singular `useWallet`. The wallet list and the active party state cover it:

- `useWallets` (`/query`) returns the list of available wallets.
- `usePartyState` (main) returns the active party/account state once connected.

## Before and after

v1 (context model, single import):

```tsx
import { CantonConnectProvider, useCantonConnect, useSession } from '@partylayer/react';

function Wallet() {
  const client = useCantonConnect();
  const session = useSession(); // legacy SDK getter
  return <div>{session?.account?.partyId}</div>;
}

function App() {
  return (
    <CantonConnectProvider client={client}>
      <Wallet />
    </CantonConnectProvider>
  );
}
```

v2 (TanStack Query model):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerProvider, usePartyState } from '@partylayer/react';
import { useWallets } from '@partylayer/react/query';

const queryClient = new QueryClient();

function Wallet() {
  const { party } = usePartyState();    // reactive party state
  const { data: wallets } = useWallets(); // the wallet list
  return <div>{party}</div>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerProvider client={client}>
        <Wallet />
      </PartyLayerProvider>
    </QueryClientProvider>
  );
}
```

## Codemod summary

| Change | Type | Old | New |
|---|---|---|---|
| Add the query cache | SETUP | (none) | wrap in `QueryClientProvider`, install `@tanstack/react-query` |
| Data hooks entry | SETUP | `from '@partylayer/react'` | `from '@partylayer/react/query'` (query/mutation hooks) |
| Legacy session getter | MECHANICAL | `useSession()` | `useClientSession()` |
| Provider alias | MECHANICAL | `CantonConnectProvider` | `PartyLayerProvider` |
| Client hook alias | MECHANICAL | `useCantonConnect` | `usePartyLayer` |

The MECHANICAL rows are pure find/replace. The SETUP rows need the `QueryClientProvider`
wrapper and the `/query` import path. After that, the new hooks (`usePartyState`,
`useDamlContract`, `useChoice`, `useTransactionCostEstimate`, `usePaidTrafficCost`) are
additive: adopt them as needed.
