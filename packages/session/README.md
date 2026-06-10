# @partylayer/session (Step 6a — core)

Framework-agnostic session manager over the CIP-0103 provider abstraction —
the **wagmi-core-equivalent for Canton**. Tracks connection status and the
active account/party, reacts to `statusChanged` / `accountsChanged`, supports
restore/reconnect, and exposes a subscribable store for React
`useSyncExternalStore` (Step 6b) and Vue composables.

> **Status: `private` (unpublished), v0.1.0.** The API is still forming and the
> React hooks land in **Step 6b** (a separate PR). Keeping the package private
> keeps it out of the published-API snapshot gate until 6b/stabilization (same
> rationale as `@partylayer/testing`). **No React/Vue/DOM code lives here.**

## Usage

```ts
import { createSessionStore } from '@partylayer/session';

const store = createSessionStore(provider /* any CIP0103Provider */, {
  // storage is OPTIONAL — defaults to in-memory (no DOM access).
  // In a browser, inject a localStorage adapter:
  // storage: { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v), removeItem: (k) => localStorage.removeItem(k) },
});

const unsubscribe = store.subscribe(() => {
  const s = store.getSnapshot(); // { status, account, accounts, networkId, lastError }
  console.log(s.status, s.account?.partyId);
});

await store.init();          // restore/reconnect on mount (probes provider.status())
await store.connect();       // → 'connecting' → 'connected'
await store.disconnect();    // → 'disconnected'
unsubscribe();
store.destroy();             // removes provider listeners
```

## State machine

```
disconnected ──connect()──▶ connecting ──ok / statusChanged(true)──▶ connected
     ▲                          │                                       │
     │                          └──── error / rejection ────────────────┤
     ├──────── disconnect() / statusChanged(false) ──────────────────────┘
     └──restore()/init()──▶ reconnecting ──active session──▶ connected
                                  └────── none ──▶ disconnected
```

`getSnapshot()` returns a **stable reference** between notifications (swapped
only on real change), so it is safe for `useSyncExternalStore`.

## What it tracks (the CIP-0103 surface)

- **Status** — from `statusChanged` (`connection.isConnected`) + the store's
  own in-flight state (`connecting`/`reconnecting`).
- **Accounts** — from `accountsChanged` (`CIP0103Account[]`); the active
  account is the `primary` one (or the first).
- **Network** — `networkId` (CAIP-2), derived from `statusChanged.network` /
  `getActiveNetwork()`. The WC adapter does **not** emit `chainChanged` today,
  so we derive it forward-compatibly and also subscribe to a future
  `chainChanged` event (harmless no-op until a provider emits it).

## Persistence

Persistence is **pluggable** — inject a `SessionStorage` (`getItem`/`setItem`/
`removeItem`, sync or async). The default is in-memory, so the core runs in any
runtime (Node/RN/browser) and tests are deterministic. The auto-reconnect
marker is written on connect and cleared on disconnect; `restore()` verifies
against the live provider before trusting it.

## What Step 6b (React hooks) will need

- A provider source for the hooks (e.g. `client.asProvider()` /
  `createProviderBridge`) to pass to `createSessionStore`.
- `useSyncExternalStore(store.subscribe, store.getSnapshot)` for `useAccount`
  and friends; `store.init()` in an effect on mount; `store.destroy()` on
  unmount.
- A backward-compatible mapping so the existing `useSession()` (which returns
  the SDK `Session | null`) keeps working — map the core snapshot
  (`status`/`account`) onto that shape, or keep `useSession` reading the SDK
  client while new hooks read the core. (The current React context tracks the
  SDK-level `session:connected/disconnected/expired` events, a different layer
  from this core — 6b reconciles them.)
- Inject a `localStorage`-backed `SessionStorage` in the browser.

## pass 2 (LATER)

A `// pass 2` marker in `src/store.ts` (`restore()`) marks where TanStack Query
cache wiring will attach. Not built in 6a.

## Encrypted persistence (M1-S1)

Two **additive** `SessionStorage` backends encrypt the persisted session at rest
with **AES-GCM-256**, conforming to the existing `SessionStorage` contract
(`getItem`/`setItem`/`removeItem`, `MaybePromise`-aware):

```ts
import {
  createEncryptedIndexedDBStorage, // default
  createEncryptedLocalStorage,
  encodeSessionEnvelope,
  restoreSession,
  reconcileSession,
} from '@partylayer/session';

const storage = createEncryptedIndexedDBStorage(); // origin-bound
await storage.setItem('partylayer.session', encodeSessionEnvelope(snapshot));

// later (e.g. after reload):
const restored = await restoreSession(storage, 'partylayer.session'); // snapshot | null
if (restored) {
  const diff = reconcileSession(restored, { account: liveAccount, networkId });
  if (!diff.matches) { /* user changed account/network while away */ }
}
```

### Key-handling invariant (the security floor)

The AES-GCM-256 `CryptoKey` is **always generated non-extractable** and **always
stored in IndexedDB** (via structured clone — `localStorage` can only hold
strings, never a `CryptoKey`). **Only the ciphertext blob location varies** by
backend. Each write uses a **fresh random 12-byte IV** stored beside the
ciphertext. Storage is **origin-bound**: key/DB/blob names embed the origin, and
this layer never embeds cross-origin data (browsers also partition storage per
origin).

### Backend matrix

| Backend | Ciphertext blob | AES key location | Key extractable |
|---|---|---|---|
| `createEncryptedIndexedDBStorage` (default) | IndexedDB | IndexedDB | **no** |
| `createEncryptedLocalStorage` | localStorage | **IndexedDB** | **no** |

### Versioned envelope + migration

The persisted plaintext is a versioned envelope (`{ version: 1, account,
accounts, networkId, connectedAt, expiresAt? }`). `migrateSessionEnvelope`
is a switch-on-`version` scaffold: known versions map forward into the current
snapshot; an **unknown future version returns `null`** and `restoreSession`
clears it. (Distinct from the crypto-envelope format version that governs the
at-rest ciphertext shape.)

### Restore safety

`getItem`/`restoreSession` return **`null` and clear the entry** — never throw
into app code — on a corrupted blob, a wrong/rotated key, an unknown future
version, or an expired snapshot.

### Honest threat model — what this does and does NOT protect

- **Protects:** persisted session data **at rest** and against **casual
  inspection** (devtools, disk, another app reading raw storage) — the value is
  ciphertext and the key is non-extractable.
- **Does NOT protect against same-origin XSS.** In-page JavaScript on your
  origin can use the same non-extractable key through the very same
  `encrypt`/`decrypt` APIs (the key handle is reachable from the page). This
  layer is **not** a defense against script injection — fix XSS at the source
  (CSP, input handling). No overclaiming.

### Session lifecycle scenarios (grant acceptance seed)

| ID | Scenario | Backends |
|---|---|---|
| SCENARIO-1 | persist → simulated reload → restore happy path | IndexedDB + localStorage |
| SCENARIO-2 | reconcile snapshot vs live status → structured diff (no crash) | n/a (pure) |
| SCENARIO-3 | corrupt / wrong-key / unknown-version / expired → `null` + cleared | both |
| (inv) | per-write IV uniqueness; key non-extractability; localStorage zero key material | both |

## Resilience: reconnect + expiry re-auth (M1-S2)

**Additive** — opt-in via `SessionStoreOptions`; omitting them preserves the
legacy behavior exactly.

```ts
const store = createSessionStore(provider, {
  reconnect: { baseDelayMs: 500, factor: 2, maxDelayMs: 30_000, maxAttempts: 5 },
  expiry: { ttlMs: 60 * 60_000, onReauthRequired: async () => { await reconnect(); } },
});
store.on('reconnect:scheduled', (e) => console.log(`retry #${e.attempt} in ${e.delayMs}ms`));
store.on('session:expired', () => showReauthPrompt());

// New ops during re-auth: queued, resumed on success, rejected on failure/overflow.
const receipt = await store.enqueue(() => submitTx());
```

### Automatic reconnect (exponential backoff)

Fires **only on a TRANSIENT disconnect** — a provider-driven
`statusChanged(isConnected:false)` while a session was active that was **not** an
explicit `store.disconnect()`. **Never** reconnects after a user disconnect.

| `RetryPolicy` field | Default | Meaning |
|---|---|---|
| `baseDelayMs` | `500` | delay before retry #1 |
| `factor` | `2` | `delay = base * factor^(attempt-1)` |
| `maxDelayMs` | `30000` | cap on any single delay |
| `maxAttempts` | `5` | give up after this many |
| `jitter?` | `false` | randomize each delay into [50%,100%] (opt-in) |

Events: `reconnect:scheduled {attempt, delayMs}` → `reconnect:attempt {attempt}` →
`reconnect:succeeded {attempt}` (state restored) **or** `reconnect:gaveup
{attempts, lastError}` (terminal `disconnected`). `reconnect` omitted or `false`
⇒ disabled.

### Runtime expiry → graceful re-auth

When `expiry.ttlMs` is set, an active session arms a timer; on expiry the store
emits `session:expired {expiredAt}` and invokes `onReauthRequired({reason, expiredAt})`.
During re-auth, operations submitted via **`store.enqueue(op)`** are held in a
**bounded** queue (`pendingQueueSize`, default `32`):

- re-auth **succeeds** → queued ops resume (in order) on the fresh session;
- re-auth **fails** → queued ops reject with a clear error;
- queue **overflow** → that op rejects immediately with a clear error.

#### Honest limit (no overclaiming)

This preserves **queued intent + session context** across re-auth. It does **NOT**
resurrect a transaction already handed to the wallet — once a request is inside
the wallet, its fate is the wallet's. `enqueue` is for operations you route
through the store, not for in-flight wallet prompts.

### Session lifecycle scenarios (now 7 of the grant's ≥8)

| ID | Scenario |
|---|---|
| SCENARIO-1 | persist → reload → restore (both backends) |
| SCENARIO-2 | reconcile snapshot vs live → structured diff |
| SCENARIO-3 | corrupt / wrong-key / unknown-version / expired → null + cleared |
| SCENARIO-4 | runtime expiry → `session:expired` + `onReauthRequired` + state preserved → resume |
| SCENARIO-5 | transient disconnect → backoff at exact offsets (incl. cap) → success restores |
| SCENARIO-6 | maxAttempts exhausted → `reconnect:gaveup` (terminal); manual cancel mid-backoff |
| SCENARIO-7 | enqueue during re-auth → resume / overflow / re-auth-failure |
| invariant | explicit user disconnect NEVER schedules a reconnect |

## Multi-tab sync + party/network invalidation (M1-S3)

**Additive + opt-in.** Origin-bound `BroadcastChannel` sync, party-switch +
network-change detection with an invalidation hook, and optional full-snapshot
persistence.

```ts
const store = createSessionStore(provider, {
  broadcast: true,                 // sync across tabs (default channel)
  persistSnapshot: true,           // rewrite the S1 snapshot on party/network change
  onInvalidate: ({ type, previous, current }) => queryClient.invalidateQueries(),
});
store.on('party:changed', (e) => console.log(`party ${e.previous} → ${e.current}`));
store.on('network:changed', (e) => console.log(`network ${e.previous} → ${e.current}`));
```

### Multi-tab (BroadcastChannel)

`broadcast: true` opens an **origin-bound** channel (`partylayer.session.sync::<origin>::<storageKey>`,
the S1 `originTag` pattern); pass `{ channelFactory }` to customize (tests inject
an in-memory hub). A **disconnect in one tab propagates to all tabs**; party/network
updates propagate too. A RECEIVING tab applies the change **without
rebroadcasting** (loop-safe — verified: BroadcastChannel never echoes to the
sender). When BroadcastChannel is **unavailable** (SSR / Node) it is a **graceful
no-op** — single-tab behavior is unchanged.

### Party-switch

On `accountsChanged`, the store compares the **primary** `partyId`. A change from
a prior non-null primary emits `party:changed {previous, current}`, calls
`onInvalidate`, and (with `persistSnapshot`) rewrites the persisted snapshot. A
**list reorder that keeps the same primary is NOT a switch** (no event).

### Network / synchronizer change

A `statusChanged.network` (or `chainChanged`) `networkId` delta emits
`network:changed {previous, current}`, calls `onInvalidate`, and rewrites the
snapshot. (Cache wiring — React-Query — lands in S4/S6; the session layer only
emits + invalidates.)

### `persistSnapshot`

When `true`, the store persists the **full S1 session envelope** at `storageKey`
(rewritten on party/network change) instead of the legacy `'1'` marker. Default
`false` (marker behavior preserved — purely additive).

### Session lifecycle scenarios (now 11 — past the grant's ≥8 threshold)

| ID | Scenario |
|---|---|
| 1–3 | persist/restore, reconcile, corrupt/wrong-key/unknown-version/expired (S1) |
| 4–7 | expiry re-auth, reconnect backoff, give-up/cancel, enqueue queue (S2) |
| SCENARIO-8 | disconnect in tab A → tab B disconnected, **no rebroadcast** |
| SCENARIO-9 | party switch → `party:changed` + snapshot rewrite; reorder → no event |
| SCENARIO-10 | network change → `network:changed` + `onInvalidate` + snapshot update |
| SCENARIO-11 | no BroadcastChannel → single-tab still works (graceful no-op) |
