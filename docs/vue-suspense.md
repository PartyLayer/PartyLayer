# Suspense with the Vue query composables

The `@partylayer/vue` query composables (`useTransactionCostEstimate`,
`usePaidTrafficCost`, `useDamlContract`) are already Suspense-ready. You do not need
a separate "suspense" composable, because Vue's Suspense works differently from
React's.

## Why there is no separate suspense composable

React needs distinct suspense hooks (`useSuspenseQuery`), so `@partylayer/react`
ships `useSuspenseTransactionCostEstimate` and friends. Vue does not work that way.
`@tanstack/vue-query`'s `useQuery` returns a `suspense()` function on its result, and
the idiom is to `await suspense()` inside an `async setup()` and wrap the component in
Vue's `<Suspense>`. There is no separate suspense API.

Our composables spread the full `useQuery` result (`...result`), so `suspense()` flows
straight through. It is part of the return type (`UseQueryReturnType` includes
`suspense`), so TypeScript sees it too. Mutations (`useChoice`) do not suspend, so they
do not expose `suspense()`.

## The pattern

A component with `async setup()` calls a query composable, awaits `suspense()`, and
returns the reactive data. The consumer wraps it in `<Suspense>` with a fallback:

```vue
<!-- CostPanel.vue (the component that suspends) -->
<script setup lang="ts">
import { useTransactionCostEstimate } from '@partylayer/vue';
import { fetchCostEstimate } from './my-cost-fetcher';

const { suspense, costEstimate } = useTransactionCostEstimate({ estimate: fetchCostEstimate });
// Suspends this component until the query first resolves.
await suspense();
</script>

<template>
  <!-- costEstimate is resolved here (never the loading state) -->
  <div>Total: {{ costEstimate?.totalTrafficCostEstimation ?? 'n/a' }}</div>
</template>
```

```vue
<!-- The consumer wraps it in <Suspense> with a fallback -->
<script setup lang="ts">
import { Suspense } from 'vue';
import CostPanel from './CostPanel.vue';
</script>

<template>
  <Suspense>
    <CostPanel />
    <template #fallback>
      <div>Estimating cost...</div>
    </template>
  </Suspense>
</template>
```

The same pattern works for `useDamlContract` (and `usePaidTrafficCost`):

```ts
const { suspense, contract } = useDamlContract<MyContract>({ read: fetchContract });
await suspense();
// contract is resolved here
```

The QueryClient is supplied by the consumer via `VueQueryPlugin`
(`app.use(VueQueryPlugin)`), the same as for the non-suspense usage.

## SSR / server prefetch (Nuxt)

The same `suspense()` enables server-side prefetch and hydration. In an SSR setup you
call it from `onServerPrefetch` so the data is fetched on the server and reused on the
client without a refetch:

```ts
import { onServerPrefetch } from 'vue';

const { suspense, costEstimate } = useTransactionCostEstimate({ estimate: fetchCostEstimate });
onServerPrefetch(async () => {
  await suspense();
});
```

That SSR wiring (Nuxt plugin + dehydrate/hydrate of the QueryClient) is covered
separately; this page is about the client `<Suspense>` boundary.

## Notes

- Only the query composables suspend. `useChoice` is a mutation, so it has no
  `suspense()`; a mutation runs when you call `exerciseChoice`, it does not block render.
- Inside the `<Suspense>` boundary, the awaited data is resolved, so you render the
  value directly rather than a loading branch. Errors propagate to the nearest error
  boundary (or a rejected `suspense()`), so handle them as you would any async setup.
