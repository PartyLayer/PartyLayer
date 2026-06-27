'use client';

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

export { useSuspenseWallets } from './use-suspense-wallets';
export type {
  UseSuspenseWalletsParameters,
  UseSuspenseWalletsReturnType,
} from './use-suspense-wallets';

export { useDisconnect } from './use-disconnect';
export type {
  UseDisconnectParameters,
  UseDisconnectReturnType,
  DisconnectVariables,
} from './use-disconnect';

export { useSignMessage } from './use-sign-message';
export type {
  UseSignMessageParameters,
  UseSignMessageReturnType,
} from './use-sign-message';

export { useSubmitTransaction } from './use-submit-transaction';
export type {
  UseSubmitTransactionParameters,
  UseSubmitTransactionReturnType,
} from './use-submit-transaction';

export { useTransactionCostEstimate } from './use-transaction-cost-estimate';
export type {
  UseTransactionCostEstimateParameters,
  UseTransactionCostEstimateReturnType,
} from './use-transaction-cost-estimate';

export { usePaidTrafficCost } from './use-paid-traffic-cost';
export type {
  UsePaidTrafficCostParameters,
  UsePaidTrafficCostReturnType,
} from './use-paid-traffic-cost';

export { useSuspenseTransactionCostEstimate } from './use-suspense-transaction-cost-estimate';
export type {
  UseSuspenseTransactionCostEstimateParameters,
  UseSuspenseTransactionCostEstimateReturnType,
} from './use-suspense-transaction-cost-estimate';

export { useSuspensePaidTrafficCost } from './use-suspense-paid-traffic-cost';
export type {
  UseSuspensePaidTrafficCostParameters,
  UseSuspensePaidTrafficCostReturnType,
} from './use-suspense-paid-traffic-cost';

// Re-export the standard cost types from core for convenience.
export type { CostEstimation, TrafficCost, PaidTrafficCost } from '@partylayer/core';
