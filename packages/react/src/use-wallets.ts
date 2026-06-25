/**
 * @partylayer/react v2 — useWallets (TanStack Query query).
 *
 * Wagmi-shaped: wraps the existing client wallet-list path in `useQuery`. The
 * underlying logic is UNCHANGED — `queryFn` calls `client.listWallets(filter)`
 * (the same method the v1 path uses to populate the context). The QueryClient is
 * supplied by the CONSUMER's `QueryClientProvider` (TanStack Query is a peer
 * dependency); `useQuery` reads it via `useQueryClient`.
 *
 * `filter` flows into BOTH the `queryFn` (forwarded to `listWallets`) and the
 * `queryKey` (`partyLayerKeys.wallets({ filter })`), so different filters cache
 * independently. Returns the TanStack query result spread, plus a wagmi-style
 * alias `wallets` (=== `data`; `WalletInfo[] | undefined` until loaded).
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { WalletFilter, WalletInfo } from '@partylayer/sdk';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

export interface UseWalletsParameters {
  /** Forwarded to `client.listWallets` AND folded into the queryKey. */
  filter?: WalletFilter;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`,
   * `refetchInterval`). `queryKey` and `queryFn` are managed by the hook and
   * cannot be overridden.
   */
  query?: Omit<UseQueryOptions<WalletInfo[], Error>, 'queryKey' | 'queryFn'>;
}

export type UseWalletsReturnType = UseQueryResult<WalletInfo[], Error> & {
  /** The wallet list (alias of `data`; `undefined` until the first load). */
  wallets: UseQueryResult<WalletInfo[], Error>['data'];
};

export function useWallets(parameters: UseWalletsParameters = {}): UseWalletsReturnType {
  const { filter, query } = parameters;
  const client = usePartyLayer();

  const result = useQuery<WalletInfo[], Error>({
    ...query,
    queryKey: partyLayerKeys.wallets({ filter }),
    // Underlying list logic is UNCHANGED — same call the v1 path makes.
    queryFn: () => client.listWallets(filter),
  });

  return {
    ...result,
    wallets: result.data,
  };
}
