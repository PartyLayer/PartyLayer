# Optimistic updates and automatic rollback (React mutation hooks)

PartyLayer's mutation hooks (`useConnect`, `useDisconnect`, `useSignMessage`,
`useSubmitTransaction`, `useChoice`) are thin wrappers over TanStack
`useMutation`. They manage only `mutationFn` and `mutationKey`; every lifecycle
callback (`onMutate`, `onError`, `onSuccess`, `onSettled`) passes through their
`mutation` option. So the standard optimistic-update pattern, optimistically write
on `onMutate` and roll back on `onError`, is already supported with no change to
any hook. This page documents the pattern and a helper that removes the
boilerplate.

## Where optimistic updates apply (and where they do not)

Classic optimistic update operates on a TanStack **query cache**: you snapshot a
cached value, write an optimistic value, and restore the snapshot if the mutation
fails. So it applies where a mutation should be reflected in a query the consumer
owns:

- `useSubmitTransaction` and `useChoice` (Model 2): a successful submit or choice
  exercise often should appear in the dApp's own query, for example the dApp's
  contract list or a `useDamlContract` query. **This is the case the pattern (and
  the helper below) is for.** PartyLayer does not own that cache; the consumer does,
  which is exactly why this is wired through the hook's pass-through `mutation`
  option rather than baked into the hook.
- `useConnect` / `useDisconnect`: account and session state lives in the reactive
  session store (read via `useSyncExternalStore` by `useAccount` / `usePartyState`),
  not a TanStack query cache. It is already live and real time, so there is nothing
  to optimistically pre-write; `setQueryData` would not touch it. Use
  `useAccountEffect` for connect/disconnect side effects.
- `useSignMessage`: updates no cache, so optimistic update is not meaningful.

## The pattern (by hand)

The canonical TanStack flow, wired through a hook's `mutation` option. Here the
consumer owns a query at `['my-app', 'contracts']` and exercises a choice that
should append to it:

```tsx
'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useChoice } from '@partylayer/react/query';

function useTransfer() {
  const queryClient = useQueryClient();
  const queryKey = ['my-app', 'contracts'] as const;

  return useChoice<ExerciseResult, TransferVars>({
    exercise: (variables) => myLedgerClient.exercise(variables),
    mutation: {
      async onMutate(variables) {
        // 1. Cancel outgoing refetches so they do not clobber the optimistic write.
        await queryClient.cancelQueries({ queryKey });
        // 2. Snapshot the current value for rollback.
        const previous = queryClient.getQueryData<Contract[]>(queryKey);
        // 3. Optimistically write the next value.
        queryClient.setQueryData<Contract[]>(queryKey, (prev) => [
          ...(prev ?? []),
          optimisticContractFor(variables),
        ]);
        // 4. Return the snapshot as context for onError.
        return { previous };
      },
      onError(_error, _variables, context) {
        // 5. Roll back to the snapshot on failure.
        queryClient.setQueryData(queryKey, context?.previous);
      },
      onSettled() {
        // 6. Resync with the server once the mutation settles.
        queryClient.invalidateQueries({ queryKey });
      },
    },
  });
}
```

The same `mutation` block works on `useSubmitTransaction` (and any of the mutation
hooks), because they all pass these callbacks through unchanged.

## The helper

`optimisticMutationOptions` builds the `onMutate` / `onError` / `onSettled` trio so
you do not repeat the boilerplate. It is an additive utility on
`@partylayer/react/query`; it does not change any hook.

```tsx
'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useChoice, optimisticMutationOptions } from '@partylayer/react/query';

function useTransfer() {
  const queryClient = useQueryClient();

  return useChoice<ExerciseResult, TransferVars>({
    exercise: (variables) => myLedgerClient.exercise(variables),
    mutation: optimisticMutationOptions<Contract[], TransferVars>({
      queryClient,
      queryKey: ['my-app', 'contracts'],
      update: (previous, variables) => [...(previous ?? []), optimisticContractFor(variables)],
      // invalidate: false,  // skip the onSettled refetch if the server response is authoritative
    }),
  });
}
```

What it does, identical to the by-hand version:

- `onMutate`: `cancelQueries`, snapshot via `getQueryData`, optimistic
  `setQueryData` using your `update`, and returns `{ previous }` as context.
- `onError`: rolls back with `setQueryData(queryKey, context.previous)`.
- `onSettled`: `invalidateQueries(queryKey)` (unless `invalidate: false`).

You can still add your own `onSuccess` alongside the spread; only `mutationFn` and
`mutationKey` are off limits (the hook manages those).

### Signature

```ts
optimisticMutationOptions<TQueryData, TVariables>(config: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  update: (previous: TQueryData | undefined, variables: TVariables) => TQueryData;
  invalidate?: boolean; // default true
}): Pick<UseMutationOptions<unknown, Error, TVariables>, 'onMutate' | 'onError' | 'onSettled'>
```

`TQueryData` is the shape of the cache entry at `queryKey`; `TVariables` is your
mutation's variables type. The returned trio spreads directly into any mutation
hook's `mutation` option with no context-type friction.

## Notes

- Optimistic update is a UX affordance, not a correctness mechanism. The server
  (the dApp's ledger) remains authoritative; `onSettled` invalidation reconciles
  the cache with reality, and `onError` rollback covers failures.
- The helper targets a single `queryKey`. For a mutation that should optimistically
  touch several queries, write the callbacks by hand (or call the helper per key
  and compose), since the rollback context must carry every snapshot.
