# Pinia integration (optional)

`@partylayer/vue` ships an optional Pinia integration for teams that centralize state
in Pinia. It is an OPTION, not the default. The default is provide/inject
(`provideSessionStore` / `createPartyLayerSession`) plus the composables
(`useSession` / `useAccount` / `usePartyState`), which need no Pinia.

The Pinia store wraps the SAME `@partylayer/session` `SessionStore` the composables
wrap, so it stays consistent with them: same session, same state, same actions.

## When to use which

- Default (provide/inject + composables): most apps. No extra dependency. Read the
  session with `useSession` / `useAccount` / `usePartyState`.
- Pinia: when your app already centralizes state in Pinia and you want the PartyLayer
  session in your store (devtools timeline, store composition, cross-component access
  without prop drilling or a provider higher in the tree).

You can use both: the Pinia store wraps the same session store, so it never disagrees
with the composables.

## Install

Pinia is an OPTIONAL peer dependency. Install it only if you use this integration:

```bash
npm install pinia
```

The integration lives on a subpath (`@partylayer/vue/pinia`), so importing the main
entry never pulls in `pinia`. Consumers who do not use Pinia are unaffected.

## Setup

```ts
// main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createSessionStore } from '@partylayer/session';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());

// Build (or reuse) the session store, then bind a Pinia store to it.
const sessionStore = createSessionStore(myProvider, { persistSnapshot: true });
app.mount('#app');
```

```ts
// stores/partylayer.ts
import { definePartyLayerStore } from '@partylayer/vue/pinia';
import { sessionStore } from '../session'; // your SessionStore instance

export const usePartyLayerStore = definePartyLayerStore(sessionStore);
```

`definePartyLayerStore(store)` takes the `SessionStore` explicitly (e.g. the one
`provideSessionStore(...)` returns, or one from `createSessionStore(...)`) and returns
a Pinia `useStore` composable bound to it. Taking the store explicitly keeps it robust
(no inject-timing dependency) and lets it share the exact session store you already set
up with `createPartyLayerSession`.

## Using the store

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePartyLayerStore } from '../stores/partylayer';

const pl = usePartyLayerStore();
// Access values directly, or use storeToRefs to keep reactivity when destructuring:
const { party, isConnected, networkId } = storeToRefs(pl);
</script>

<template>
  <button v-if="!pl.isConnected" @click="pl.connect()">Connect</button>
  <div v-else>{{ party }} on {{ networkId }} <button @click="pl.disconnect()">Disconnect</button></div>
</template>
```

## Surface

State (mirrors `usePartyState`, kept in sync via the session store's subscribe):

- `status`, `account`, `accounts`, `networkId`, `lastError`
- `party` (alias of `account.partyId`), `isConnected`, `isDisconnected`

Actions (delegate to the wrapped session store):

- `connect(params?)`, `disconnect()`, `restore()`

The session store is the single source of truth; the Pinia store mirrors its state
reactively and delegates its actions, so it never diverges from the composables.
