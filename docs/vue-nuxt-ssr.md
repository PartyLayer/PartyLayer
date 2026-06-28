# Nuxt 3 SSR and hydration

`@partylayer/vue` is SSR-safe and works under Nuxt 3, with server-side fetching of
the dApp's query data (cost, contracts) and clean hydration. The wallet connection
itself is client-only, which is correct for a wallet. This page covers the
guarantees, the Nuxt plugin setup, server prefetch, and hydration.

## SSR-safety guarantees

The package renders on the server without touching the browser:

- **No browser APIs at import or setup time.** The only `window` access is a guarded
  `typeof window !== 'undefined'` check, and `init()` runs client-only (`onMounted` /
  the guard), so server rendering never touches the wallet.
- **Disconnected snapshot on the server.** Without an initialized store, the
  composables (`useSession` / `useAccount` / `usePartyState`) return a stable
  disconnected snapshot, and the actions are no-ops. So the server renders the
  disconnected state, and the client hydrates to the same state with no mismatch.
- **`renderToString` works.** Rendering a component that uses the composables to a
  string in a server (no-window) environment does not throw and shows the
  disconnected state.

## The wallet connection is client-only (by design)

You cannot connect a wallet on the server: the wallet provider lives in the browser.
So "server-side party fetching" applies to the dApp's own query data (cost estimates,
DAML contracts) via the query composables, not to the wallet connection. The server
renders the disconnected session, and the wallet connects on the client after
hydration. This is correct and expected, and because the SSR snapshot is the stable
disconnected state, it hydrates cleanly.

## Nuxt plugin: VueQueryPlugin + dehydrate/hydrate

This is the standard vue-query Nuxt 3 plugin. It lives in your Nuxt app (it uses
Nuxt APIs like `useState` and the Nuxt hooks), so copy it into `plugins/`:

```ts
// plugins/vue-query.ts
import { VueQueryPlugin, QueryClient, hydrate, dehydrate } from '@tanstack/vue-query';
import { defineNuxtPlugin, useState } from '#app';

export default defineNuxtPlugin((nuxt) => {
  const vueQueryState = useState<unknown>('vue-query');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 5000 } },
  });

  nuxt.vueApp.use(VueQueryPlugin, { queryClient });

  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      vueQueryState.value = dehydrate(queryClient);
    });
  }
  if (import.meta.client) {
    nuxt.hooks.hook('app:created', () => {
      hydrate(queryClient, vueQueryState.value);
    });
  }
});
```

The session store can be provided the same way you provide it client-side (e.g.
`createPartyLayerSession` as a Nuxt plugin, or `provideSessionStore` in your root
setup). Its `init()` runs client-only, so it is safe to register on the server.

## Server-side fetching of query data

In a page, fetch the dApp's query data on the server with `onServerPrefetch` and the
query composable's `suspense()` (the query composables expose `suspense()`; see
[vue-suspense.md](./vue-suspense.md)). The data is fetched on the server, dehydrated
by the plugin, and hydrated on the client, so there is no loading flash:

```vue
<script setup lang="ts">
import { onServerPrefetch } from 'vue';
import { useTransactionCostEstimate } from '@partylayer/vue';
import { fetchCostEstimate } from '../lib/cost';

const { suspense, costEstimate } = useTransactionCostEstimate({ estimate: fetchCostEstimate, input: 'tx-1' });

// Fetch on the server so the rendered HTML already has the value.
onServerPrefetch(async () => {
  await suspense();
});
</script>

<template>
  <div>Total: {{ costEstimate?.totalTrafficCostEstimation ?? 'n/a' }}</div>
</template>
```

The same pattern works for `usePaidTrafficCost` and `useDamlContract`. Mutations
(`useChoice`) do not prefetch; a mutation runs on user action, on the client.

## Hydration guidance

- The session state is the SSR-safe disconnected snapshot on the server and hydrates
  to the same value on the client, so there is no session hydration mismatch. The
  wallet connects after hydration (client-only), which updates the state reactively.
- Cost and DAML query data is dehydrated on the server and hydrated on the client via
  vue-query, so the server and client caches agree. Use the same `input`/`key` on
  both sides so the query keys match (the keys come from `partyLayerKeys`, shared with
  the composables).
- Do not read `window`/`document` in your own `setup()` for SSR pages; the package
  itself does not, so it will not cause a mismatch.
