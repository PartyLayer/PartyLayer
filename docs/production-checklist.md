# Production Migration Checklist

**Checks to run before taking a PartyLayer dApp to production.**

This checklist links to the docs that already cover each topic and writes only what is
missing. For each item it states what the kit provides, what the dApp owns, and the
concrete checks to run. Where a topic is documented elsewhere, follow the link rather than
copying the detail here.

## Network Promotion (DevNet to TestNet to MainNet)

**Required**

The kit provides one integration surface across networks. The network is a configuration
value, not a code change: `network="devnet"` on `PartyLayerProvider`, or the `network`
field of `createPartyLayer({ ... })`, taking `"devnet"`, `"testnet"`, or `"mainnet"`. See
[dev-and-staging.md](./dev-and-staging.md) for the ladder from Studio to a live network.

The dApp owns the values the repo cannot know: the Canton endpoints and any per-network
operator configuration come from your operator, not from PartyLayer. Where your DAML
packages live is a Canton topology question covered by
[partylayer-and-canton-topology.md](./partylayer-and-canton-topology.md). The registry
ships a `stable` and a `beta` channel (`registry/v1/stable`, `registry/v1/beta`); choosing a
channel and its URL is operator and registry configuration, covered by
[registry-ops.md](./registry-ops.md) and [registry-onboarding.md](./registry-onboarding.md).

What actually changes between networks:

- The network id (`devnet`, `testnet`, `mainnet`).
- The wallet set available on that network. Confirm each wallet you rely on in the
  [wallet-cip0103-matrix.md](./wallet-cip0103-matrix.md) before promoting.
- The registry channel and URL (operator configuration).

Session and storage isolation, so a devnet session cannot leak into a mainnet app:

- A session carries its network. On startup the kit calls `restore()`, which revalidates
  against the live provider, and a wrong-network session surfaces as `NETWORK_MISMATCH`
  (`NetworkMismatchError`), not a silent connect. See [errors.md](./errors.md).
- Session storage is origin scoped, so two deployments on different origins never share a
  persisted session.

Checks before promotion:

- Confirm every wallet you use is supported on the target network in the matrix.
- Confirm the operator supplied endpoints and the registry channel for the target network.
- Confirm a session persisted on one network does not restore into an app configured for
  another (expect `NETWORK_MISMATCH`).

## Bundle Regression

**Required**

Bundle cost and its enforcement are covered by [performance.md](./performance.md): the
measured baseline, the per scenario budgets, and the `gate:size` stage. Do not restate
those numbers here; read them there.

Pre-release checks:

- Budgets green: `pnpm gate:size` (also runs inside `pnpm gate`).
- Tree shaking preserved: consumers import named exports from the narrowest subpath (for
  example `@partylayer/react/query`), use ESM, and never use namespace imports such as
  `import * as PartyLayer from '@partylayer/react'`.
- No new runtime dependency added to a published package.

## Production Cache Configuration

**Recommended**

The kit exposes `partyLayerKeys`, a TanStack Query key factory with 22 keys: a root `all`
scope, eight parameterized read keys, three parameterless state keys, and ten write keys
used as mutation keys.

`staleTime`, `gcTime`, and `refetchOnWindowFocus` apply only to the read keys. They are
meaningless for the mutation keys (`connect`, `disconnect`, `signMessage`,
`submitTransaction`, `exerciseChoice`, `transferInstruction`, `transferInstructionAction`,
`allocationInstruction`, `allocationAction`, `allocationRequestAction`), which have no
cached result to age, so do not set them there.

Group the read keys by data class and tune each class for how its data changes:

- Registry data, changes rarely: `wallets`, `registryStatus`. Use a long `staleTime`. The
  registry client already caches with its own TTL (see Caching in
  [performance.md](./performance.md)).
- Ledger activity data, changes on ledger writes: `tokenHoldings`, `tokenAllocations`,
  `transferInstructions`, `allocationRequests`, `damlContract`. Use a moderate `staleTime`
  and invalidate after a related mutation rather than polling.
- Cost estimates, go stale quickly: `transactionCostEstimate`, `paidTrafficCost`. Use a
  short `staleTime` so a stale price is not shown.
- Session and account state, event driven not polled: `session`, `account`. These update
  from session events, so keep `refetchOnWindowFocus` off and rely on invalidation.

Invalidate through `partyLayerKeys`, never the raw `key` you passed a hook. The raw `key`
is namespaced into the query key, so prefix invalidating with it matches nothing. The rule
and its rationale live in the JSDoc of `packages/react/src/query-keys.ts`.

```ts
// Clears every wallet-holdings instance:
queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
```

## Error Boundaries and Vendor Error Reporting

**Required**

The kit provides the error taxonomy in [errors.md](./errors.md) and the vendor telemetry
mapping in [observability.md](./observability.md), with working adapters under
[../examples/telemetry-adapters](../examples/telemetry-adapters). What is missing is the
boundary pattern.

Expected operational errors arrive as values in a hook's `error` field, not as thrown
exceptions, and should be handled in the UI rather than caught by a boundary. Map the
error `code` to a message using the UX Message column in [errors.md](./errors.md):

- `USER_REJECTED` (`UserRejectedError`)
- `SESSION_EXPIRED` (`SessionExpiredError`)
- `NETWORK_MISMATCH` (`NetworkMismatchError`)
- `INSUFFICIENT_TRAFFIC` (`InsufficientTrafficError`)

```tsx
const { error } = useSubmitTransaction();
// PartyLayerError carries a stable `code`; render the mapped message, do not rethrow.
if (error instanceof PartyLayerError) return <Notice>{messageFor(error.code)}</Notice>;
```

A React error boundary is for the genuinely exceptional: a render time throw from a bug,
not the operational cases above. Place the boundary as a parent of the subtree that renders
PartyLayer components, inside `PartyLayerProvider` so the provider stays mounted while the
boundary reports the throw to your telemetry adapter.

Checks:

- Confirm the four operational codes are handled in the UI and do not reach the boundary.
- Confirm the boundary reports to your vendor adapter (see the telemetry adapters example).

## Observability in Production (Sampling and PII)

**Recommended**

[METRICS.md](./METRICS.md) states the privacy guarantees and enumerates the only properties
the event to telemetry bridge sends (SDK version, network name, metric counts, timestamps,
and generic error codes; app identifier and origin are opt in and hashed). It never sends
wallet addresses, raw party ids, transaction payloads, signed content, user identifiers,
or IP addresses. Sampling has a knob today: `TelemetryConfig.sampleRate` (0.0 to 1.0).

What is missing is the production sampling strategy. Lifecycle and error events are low
volume and worth sending always (`session:connected`, `session:disconnected`, and error
counters). High frequency reads, such as repeated cost estimates, warrant sampling below
1.0 at scale. Set the rate with `sampleRate`.

Verification the operator can run, given the bridge sends only the safe properties:

- Point the telemetry adapter at a capture you control (the console adapter in the example,
  or a proxy) and drive a full connect, read, and submit flow.
- Assert none of the never collected values appear in the captured payloads.
- Confirm origin is either absent or hashed (it is opt in through `includeOrigin`), so a
  raw origin does not reach the vendor.

See [EVENT_SPEC.md](./EVENT_SPEC.md) for the per event property set.

## Synchronizer Failover

**Required**

Be clear about the boundary: there is no synchronizer selection or failover logic in the
sdk. `SynchronizerSwitcher` is a presentational component. It takes a `networkId`, an
`options` array the consumer supplies, and an `onSwitch(networkId)` callback the consumer
implements; it renders nothing when there are no options. The dApp owns routing.

What the dApp owns:

- Where the list of synchronizers comes from (the consumer supplies `options`).
- What to do when the active synchronizer is unavailable, including retry and backoff.
- What to re invalidate after a switch: the party scoped query keys, through
  `partyLayerKeys`, so reads refetch against the new synchronizer.
- The token standard constraint that a submission's disclosed contracts must all share one
  synchronizer. Enforce it with `assertSingleSynchronizer` from `@partylayer/react/query`
  before submitting.

Routing failures surface in the dApp's own ledger and registry calls, not in the kit's
error taxonomy. Synchronizer level conditions get no PartyLayer code, and
`assertSingleSynchronizer` throws a plain `Error`, not a `PartyLayerError`. See the
synchronizer note in [errors.md](./errors.md).

Checks:

- After a synchronizer switch, invalidate the party scoped keys.
- Call `assertSingleSynchronizer` before any submission that spans disclosed contracts.

## Cost Accuracy Monitoring

**Recommended**

The kit exposes `CostEstimation`, `PaidTrafficCost`, `toTrafficCost`, and
`trafficCostToBigInt` in `@partylayer/core`, with `usePaidTrafficCost` and
`useTransactionCostEstimate` in `@partylayer/react` and the same two in `@partylayer/vue`.

Monitor drift between the estimate shown to a user and the cost actually paid:

- Record the estimate (`CostEstimation.totalTrafficCostEstimation`) shown before submit and
  the `PaidTrafficCost` observed after execution.
- Compare with `trafficCostToBigInt`, not float math. Traffic costs are integer quantities,
  and float subtraction loses precision.
- The drift magnitude worth alerting on is the operator's call, not ours, because it
  depends on your traffic economics and how conservative your estimates are.

This ties to the insufficient traffic path: a persistent under estimate leaves users short
and they hit `INSUFFICIENT_TRAFFIC` (`InsufficientTrafficError`) at submit. See
[errors.md](./errors.md).

```ts
const drift = trafficCostToBigInt(paid) - trafficCostToBigInt(estimate.totalTrafficCostEstimation);
```

## SSR and RSC in Production

**Recommended**

The mechanics are covered: [react-cookie-ssr.md](./react-cookie-ssr.md) for the cookie
backed session (`createCookieStorage`, `decodeSessionEnvelope`, `next/headers`), and
[vue-nuxt-ssr.md](./vue-nuxt-ssr.md) for the Nuxt disconnected snapshot plus query
hydration. What is missing is the production concerns.

Cache headers: a page that carries session state is per user. Do not cache it at a shared
CDN. Mark session bearing responses private or no-store so one user's connected HTML is
never served to another.

Edge runtime constraints, verified from the session package source, not assumed:

- `createMemoryStorage`: edge safe (pure in memory, no DOM).
- `createCookieStorage`: edge safe when given a server cookie adapter (for example
  `next/headers` `cookies()`); the default adapter uses `document.cookie` and is inert on
  the server.
- `createEncryptedIndexedDBStorage`: not edge safe. It requires IndexedDB and WebCrypto.
- `createEncryptedLocalStorage`: not edge safe. It requires localStorage, and the key is
  still held in IndexedDB.

So on an edge runtime, use `createMemoryStorage` or a server backed `createCookieStorage`;
the two encrypted browser backends cannot run there.

Hydration expectation: with cookie storage the connected party appears in the initial HTML
and the first client paint matches, so there is no disconnected to connected flash. A
client only adapter (for example `createLocalStorage` from `@partylayer/react`) paints
disconnected first and then flips after hydration.

Checks:

- Confirm session bearing pages set private cache headers.
- Confirm only the edge safe adapters run on an edge runtime.
- Confirm the connected party is in the server HTML with no hydration flash.

## Multi Framework Consistency

**Recommended**

The frameworks are not at parity, and choosing one means choosing what you get today.
Measured from the api snapshots: `@partylayer/react` exposes 34 hook names (33 distinct;
`useCantonConnect` is an alias of `usePartyLayer`), `@partylayer/vue` exposes 8, and
`@partylayer/react-native` exposes 2. Vue exposes nothing react lacks.

Parity matrix, as measured:

| Capability | react | vue | react-native |
|---|---|---|---|
| Connect | `useConnect` | `useSession().connect` | `useConnect` |
| Disconnect | `useDisconnect` | `useSession().disconnect` | `useConnect().disconnect` |
| Wallet list | `useWallets` | no | `useWallets` |
| Session state | `useSession` | `useSession` | via `useConnect().session` |
| Sign message | `useSignMessage` | no | no |
| Submit transaction | `useSubmitTransaction` | no | no |
| Cost | `usePaidTrafficCost`, `useTransactionCostEstimate` | same two | no |
| CIP-0056 token surface | typed hooks (`useTokenHoldings`, `useTokenAllocations`, and the transfer and allocation hooks) plus generic `useDamlContract` and `useChoice` | generic only (`useDamlContract`, `useChoice`) | no |
| Theme | `useTheme`, `themes`, `ThemeProvider` | no | `themes`, `toReactNativeTheme` |

The shared surface all three genuinely expose is connecting and disconnecting a session.
A consistency guard locks that surface so it does not drift apart:
`scripts/gate/framework-consistency.test.mjs`, run as the `gate:consistency` stage of
`pnpm gate`. It reads the committed api snapshots and asserts that react, vue, and
react-native each expose a `connect` and a `disconnect` operation, that `disconnect` has
the same shape in all three (no arguments, returns `Promise<void>`), and that react and
react-native keep their shared `useConnect` and `useWallets` hooks. It does not assert
parity that does not exist.

Checks:

- Pick the framework whose row covers the capabilities you need.
- If you extend the shared connect surface, extend it in all three so the guard stays green.
