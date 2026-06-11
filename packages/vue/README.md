# @partylayer/vue

Vue 3 composables for PartyLayer sessions — thin reactive bindings over the
framework-agnostic [`@partylayer/session`](../session) store. Mirrors
[`@partylayer/react`](../react)'s session API.

## Install

```bash
npm install @partylayer/vue @partylayer/session vue
```

## Usage

Provide a store near the root, then read it from any descendant composable.

```ts
// main.ts — plugin form
import { createApp } from 'vue';
import { createPartyLayerSession } from '@partylayer/vue';
import App from './App.vue';

createApp(App)
  .use(createPartyLayerSession({ provider, persistSnapshot: true, broadcast: true }))
  .mount('#app');
```

```vue
<!-- or in a root setup() -->
<script setup lang="ts">
import { provideSessionStore, useSession, useAccount } from '@partylayer/vue';

provideSessionStore({ provider /* any CIP0103Provider */, reconnect: { /* … */ } });

const { status, account, networkId, isConnected, connect, disconnect, on } = useSession();
const { party, chain } = useAccount();
</script>

<template>
  <button v-if="!isConnected" @click="connect()">Connect</button>
  <div v-else>{{ party }} · {{ networkId }} <button @click="disconnect()">Disconnect</button></div>
</template>
```

Side-effects on session transitions:

```ts
import { useAccountEffect } from '@partylayer/vue';

useAccountEffect({
  onConnect: ({ account }) => {/* … */},
  onDisconnect: () => {/* … */},
  onPartyChanged: ({ previous, current }) => {/* invalidate caches */},
});
```

## Composables

- **`useSession()`** → reactive `SessionState` (`status`, `account`, `accounts`,
  `networkId`, `lastError`, `isConnected`/`isConnecting`/`isReconnecting`/
  `isDisconnected`) plus actions `connect` / `disconnect` / `restore` and the
  narrowed event subscription `on(event, handler)`.
- **`useAccount()`** → reactive `{ party, address, account, accounts, status,
  isConnected, …, networkId, chain, lastError }`.
- **`useAccountEffect({ onConnect, onDisconnect, onPartyChanged })`** →
  fire-and-forget side-effects; auto-cleans on scope teardown.

## Provisioning

- **`provideSessionStore(config)`** — core; call in a `setup()`.
- **`createPartyLayerSession(config)`** — a thin Vue plugin (`app.use(...)`)
  over the same provide (single source of truth).

`config` is **either** a pre-built `SessionStore` **or**
`{ provider: CIP0103Provider } & SessionStoreOptions`.

**Ownership rule:** when built from config, this layer owns the lifecycle —
`init()` runs **client-only** (on mount), `destroy()` on scope/app teardown. A
**pre-built** store's lifecycle belongs to you; it is never `init()`/`destroy()`d
here.

SSR-safe: the store is constructed without DOM access and `init()` is deferred to
the client; with no provided store, composables report a disconnected session and
the actions are no-ops.

## React ↔ Vue parity (deviations flagged)

| `@partylayer/react` | `@partylayer/vue` | Deviation |
|---|---|---|
| `useSession()` → plain values | `useSession()` → **Vue refs** (`ComputedRef`) | **Returns refs** — access `.value` (or auto-unwrap in templates); destructuring keeps reactivity |
| `useAccount()` → plain values | `useAccount()` → **Vue refs** | same — refs, not plain values |
| `useAccountEffect({…})` | `useAccountEffect({…})` | identical handler shape; Vue cleans up via `onScopeDispose` |
| `<PartyLayerProvider>` / `<PartyLayerKit>` (components) | **`provideSessionStore()`** / **`createPartyLayerSession()` plugin** | Vue uses provide-inject / a plugin, not a wrapper component |
| `useClientSession()` (legacy SDK getter) | — | **not ported** (Vue has no legacy SDK-session layer) |

`connect(params?)` mirrors the store's own signature exactly
(`params?: Record<string, unknown>`).
