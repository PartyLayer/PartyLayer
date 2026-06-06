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
