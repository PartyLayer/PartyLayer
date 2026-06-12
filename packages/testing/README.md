# @partylayer/testing

Offline test foundation for PartyLayer: a **mock CIP-0103 wallet provider** with
configurable failure scenarios, a **controllable transaction lifecycle**, a
**session-lifecycle harness** over the real `@partylayer/session` store, **TanStack
Query** test utilities, and **browser/e2e primitives** — so unit, integration, and
real-browser tests run with no DevNet or live-wallet dependency.

The TanStack Query utilities live in the `@partylayer/testing/query` subpath
(`@tanstack/query-core` is an optional peer) so the main entry stays
dependency-free for non-Query consumers.

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

## D. Session-lifecycle harness — `createSessionHarness(config?)`

Drives a **real** `@partylayer/session` store through a controllable provider, so
each scenario exercises the store's own machinery (no synthetic shortcuts).

```ts
import { createSessionHarness } from '@partylayer/testing';
import { vi } from 'vitest';

vi.useFakeTimers();
const h = createSessionHarness({ ttlMs: 30_000, onReauthRequired, advanceTimers: vi.advanceTimersByTimeAsync });
await h.connect();
await h.expire();             // advances the store's REAL expiry timer → session:expired
h.switchParty('party::b');    // real accountsChanged → party:changed
h.dropConnection();           // real statusChanged(false) → transient reconnect
const tabB = h.openTab();     // a 2nd store sharing the broadcast hub (multi-tab)
h.destroy(); tabB.destroy();  // per-harness teardown (children are separate)
```

`expire()` advances the store's real `setTimeout`-based expiry — it never emits a
fake `session:expired`, so pass `advanceTimers` (e.g. `vi.advanceTimersByTimeAsync`)
and install fake timers.

## E. Offline composition — `createOfflineHarness({ wallet?, session? })`

Wires a mock wallet to a real session store, fully offline:

```ts
import { createOfflineHarness } from '@partylayer/testing';
const { provider, store, destroy } = createOfflineHarness({ wallet: { partyId: 'party::a' } });
```

## F. TanStack Query utilities — `@partylayer/testing/query`

```ts
import {
  createTestQueryClient, getQueryState, expectInvalidated, trackOptimisticRollback, createQueryHarness,
} from '@partylayer/testing/query';

const qc = createTestQueryClient();                     // no retries, gcTime 0
const t = trackOptimisticRollback<number>(qc, ['count']);
t.apply(99); /* assert */ t.rollback(); /* assert restore */
const h = createQueryHarness({ wallet, session, query }); // offline harness + QueryClient
```

## G. Browser / e2e primitives

Framework-agnostic script strings (no Playwright dependency) for a real-browser
smoke (`mockWalletInjectionScript()`, `idbEntryCountScript(db)`, `sessionKeyDbName(origin)`),
injected via Playwright's `page.addInitScript` / `page.evaluate`. The smoke itself
lives in `apps/demo/e2e` and runs nightly.
