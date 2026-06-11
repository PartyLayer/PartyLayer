# @partylayer/testing (pass 1)

Offline test foundation for PartyLayer. Provides a **mock CIP-0103 wallet
provider**, a **controllable simulated transaction lifecycle**, and
**deterministic offline helpers** so unit/integration tests run with no DevNet
or live-wallet dependency.

> **Status: `private` (unpublished), v0.1.0.** The API is still forming. We
> publish **v1.0 at the 1.0 milestone** once pass 2 lands. Keeping the package
> private also keeps it out of the published-API snapshot gate while the
> surface settles — `scripts/gate/api-snapshot.mjs` only snapshots
> `"private": false` packages.

This is the test target for `@partylayer/session`, the native-path work, the
WalletConnect work, and the `create-partylayer-app` templates.

## A. Mock CIP-0103 wallet — `createMockWallet(config?)`

Returns a real `CIP0103Provider`, built by wrapping a configurable in-memory
client in the repo's canonical `createProviderBridge`. **The default/happy
config passes `runCIP0103ConformanceTests` by construction** (it is the
conformance reference implementation with a mock backend).

```ts
import { createMockWallet } from '@partylayer/testing';

const provider = createMockWallet();                 // happy path
await provider.request({ method: 'connect' });        // { isConnected: true }

// connect succeeds but submission fails:
const flaky = createMockWallet({ scenarios: { submitTransaction: 'synchronizerError' } });
```

### Failure scenarios (per-method, existing error codes only)

Scenarios are toggled per method. Every named scenario maps to a code that
**already exists** in `@partylayer/provider`'s error model — no new codes are
invented. You may also pass a raw `ProviderRpcError` or a `{ code, message }`.

| scenario name | code | constructor |
|---|---|---|
| `userRejected` | `4001` (USER_REJECTED) | `userRejected()` |
| `insufficientTraffic` | `-32002` (RESOURCE_UNAVAILABLE) | `resourceUnavailable()` |
| `synchronizerError` | `4901` (CHAIN_DISCONNECTED) | `chainDisconnected()` |
| `transactionTimeout` | `-32003` (TRANSACTION_REJECTED) | `transactionRejected()` |
| `genericError` | `-32603` (INTERNAL_ERROR) | `internalError()` |

`createMockWalletClient(config?)` exposes the underlying `BridgeableClient` as
an extension point for advanced wrapping/inspection.

## B. Simulated transaction lifecycle — `createTransactionLifecycle(config?)`

A controllable lifecycle with phase flags
`isPreparing → isSubmitting → isConfirming → isFinalized` plus a `failed`
terminal, emitting the same CIP-0103 `txChanged` events the real provider does.

```ts
import { createTransactionLifecycle } from '@partylayer/testing';

// manual stepping — deterministic, phase by phase
const lc = createTransactionLifecycle({ commandId: 'cmd-1' });
lc.on('txChanged', (e) => console.log(e.status));
lc.advance();   // → 'preparing'  emits { status: 'pending' }
lc.advance();   // → 'submitting' emits { status: 'signed', payload }
lc.advance();   // → 'confirming' (no CIP-0103 event — see below)
lc.advance();   // → 'finalized'  emits { status: 'executed', payload }
// or lc.fail() at any point → emits { status: 'failed' }

// auto mode — fake-timer friendly
const auto = createTransactionLifecycle({ delays: { preparing: 10, finalized: 50 } });
await auto.start();   // walks every phase using the delays
```

Phase → `txChanged.status`: `preparing→pending`, `submitting→signed`,
`confirming→`(none)`, `finalized→executed`, `failed→failed`. CIP-0103 has no
"confirming" status (the union goes signed → executed); `isConfirming` is the
post-signed waiting flag the session layer surfaces.

## C. Offline helpers

```ts
import { createMockWallet, recordTxEvents, connectMock } from '@partylayer/testing';

const provider = createMockWallet();
const rec = recordTxEvents(provider);                 // collect txChanged
await connectMock(provider);
await provider.request({ method: 'prepareExecute', params: { tx: {} } });
rec.statuses();   // ['pending', 'signed', 'executed']
rec.stop();
```

Optional `delays` use `setTimeout`, so `vi.useFakeTimers()` +
`vi.advanceTimersByTimeAsync()` give tests full control over time.

## Extension points for pass 2 (LATER)

Pass 2 — **after `@partylayer/session` exists** — adds session-lifecycle
simulation and TanStack Query test utilities on top of these primitives. It is
intentionally **not** built here. The `// pass 2` notes in `src/lifecycle.ts`
mark where the cumulative-flag / query-cache wiring will hook in.
