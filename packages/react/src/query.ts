/**
 * @partylayer/react/query — TanStack Query v5 entrypoint (v2 hooks).
 *
 * Architecture (wagmi model): TanStack Query is a PEER dependency. The CONSUMER
 * provides their own `QueryClientProvider`; PartyLayer does NOT create or wrap a
 * `QueryClient`. Our hooks read the QueryClient via `useQueryClient` (inside
 * `useMutation`/`useQuery`). A consumer wraps both providers:
 *
 *   <QueryClientProvider client={queryClient}>
 *     <PartyLayerProvider client={partyLayerClient}>
 *       ...
 *     </PartyLayerProvider>
 *   </QueryClientProvider>
 *
 * This file is the future home of the v2 query/mutation hooks and the
 * `useSuspenseQuery` variants. It is published as a separate subpath
 * (`@partylayer/react/query`) so importing the context-based v1 hooks from the
 * main entrypoint never pulls in TanStack Query.
 */

export { partyLayerKeys } from './query-keys';
export type { PartyLayerKeys } from './query-keys';

export { useConnect } from './use-connect';
export type {
  UseConnectParameters,
  UseConnectReturnType,
  ConnectVariables,
} from './use-connect';

export { useWallets } from './use-wallets';
export type {
  UseWalletsParameters,
  UseWalletsReturnType,
} from './use-wallets';
