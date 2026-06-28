'use client';

/**
 * @partylayer/react v2: useSuspenseWallets (TanStack Query suspense query).
 *
 * The Suspense sibling of `useWallets`, for declarative loading boundaries. It is
 * identical to `useWallets` except it uses `useSuspenseQuery` instead of
 * `useQuery`: loading and error are delegated to the nearest React `<Suspense>`
 * (and error boundary), so `data`/`wallets` is NEVER `undefined` inside the
 * rendered subtree.
 *
 * It uses the SAME `queryKey` (`partyLayerKeys.wallets({ filter })`) and SAME
 * `queryFn` (`() => client.listWallets(filter)`) as `useWallets`, so the two
 * share a single cache entry: switching between them (or rendering both) reuses
 * the same data. The underlying `listWallets` logic is UNCHANGED.
 *
 * Note (TanStack Query v5): suspense is its own hook (`useSuspenseQuery`), not the
 * removed v4 `suspense: true` option, and there is no `enabled` option, a
 * suspense query always runs.
 */
import {
  useSuspenseQuery,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
} from '@tanstack/react-query';
import type { WalletFilter, WalletInfo } from '@partylayer/sdk';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

export interface UseSuspenseWalletsParameters {
  /** Forwarded to `client.listWallets` AND folded into the queryKey. */
  filter?: WalletFilter;
  /**
   * Pass-through TanStack `useSuspenseQuery` options (e.g. `staleTime`,
   * `refetchInterval`). `queryKey` and `queryFn` are managed by the hook and
   * cannot be overridden. (`enabled` does not apply to suspense queries.)
   */
  query?: Omit<UseSuspenseQueryOptions<WalletInfo[], Error>, 'queryKey' | 'queryFn'>;
}

export type UseSuspenseWalletsReturnType = UseSuspenseQueryResult<WalletInfo[], Error> & {
  /** The wallet list (alias of `data`; always defined under Suspense). */
  wallets: UseSuspenseQueryResult<WalletInfo[], Error>['data'];
};

export function useSuspenseWallets(
  parameters: UseSuspenseWalletsParameters = {},
): UseSuspenseWalletsReturnType {
  const { filter, query } = parameters;
  const client = usePartyLayer();

  const result = useSuspenseQuery<WalletInfo[], Error>({
    ...query,
    queryKey: partyLayerKeys.wallets({ filter }),
    // Same key + same call as useWallets, they share one cache entry.
    queryFn: () => client.listWallets(filter),
  });

  return {
    ...result,
    wallets: result.data,
  };
}
