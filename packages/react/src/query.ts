'use client';

/**
 * @partylayer/react/query: TanStack Query v5 entrypoint (v2 hooks).
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

export { useDamlContract } from './use-daml-contract';
export type {
  UseDamlContractParameters,
  UseDamlContractReturnType,
} from './use-daml-contract';

// CIP-0056 (Canton Token Standard) typed holdings read: a typed specialization
// of useDamlContract for the HoldingV1 interface. Holdings read only.
export { useTokenHoldings } from './token-holdings';
export type {
  TokenHolding,
  TokenHoldingRef,
  TokenInstrumentId,
  TokenLock,
  UseTokenHoldingsParameters,
  UseTokenHoldingsReturnType,
} from './token-holdings';

// CIP-0056 typed allocations read: a typed specialization of useDamlContract for
// the AllocationV1 interface (the read-side allocation sibling of useTokenHoldings).
// Allocation read only; the write side lands later as separate typed hooks.
export { useTokenAllocations } from './token-allocations';
export type {
  TokenAllocation,
  TokenAllocationRef,
  TokenAllocationSpecification,
  TokenSettlementInfo,
  TokenSettlementReference,
  TokenTransferLeg,
  UseTokenAllocationsParameters,
  UseTokenAllocationsReturnType,
} from './token-allocations';

// Framework-free spec comparators for allocation-versus-request matching (the
// settlement venue's expected-allocation check). Decimal-as-string equality never
// converts to floats.
export {
  tokenDecimalEquals,
  tokenTransferLegEquals,
  tokenSettlementInfoEquals,
  allocationMatchesRequestLeg,
} from './token-matching';

// Framework-free typed wire shapes every CIP-0056 registry flow carries (disclosed
// contracts, choice context, factory-with-context) mirrored from the official token
// standard OpenAPI, plus a canonical merge utility for combining the disclosures of
// multiple registry contexts into one submission.
export {
  mergeDisclosedContracts,
  groupDisclosedContractsBySynchronizer,
  assertSingleSynchronizer,
} from './disclosed-contracts';
export type {
  TokenDisclosedContract,
  TokenChoiceContext,
  TokenTransferFactory,
  TokenAllocationFactory,
} from './disclosed-contracts';

export { useChoice } from './use-choice';
export type {
  UseChoiceParameters,
  UseChoiceReturnType,
} from './use-choice';

// CIP-0056 typed transfer submit: a typed specialization of useChoice for the
// TransferInstructionV1 TransferFactory_Transfer flow (the write-side sibling of
// useTokenHoldings). Transfer initiation submit only.
export { useTransferInstruction } from './transfer-instruction';
export type {
  TokenTransfer,
  TransferInstructionResultStatus,
  UseTransferInstructionParameters,
  UseTransferInstructionReturnType,
} from './transfer-instruction';

// CIP-0056 typed transfer-instruction read: the pending-instruction view + a read
// hook (the read-side sibling of the transfer write hooks).
export { useTransferInstructions } from './token-transfer-instructions';
export type {
  TokenTransferInstruction,
  TokenTransferInstructionRef,
  TokenTransferInstructionStatus,
  UseTransferInstructionsParameters,
  UseTransferInstructionsReturnType,
} from './token-transfer-instructions';

// CIP-0056 typed transfer completion: the accept/reject/withdraw sibling of
// useTransferInstruction, over the standard TransferInstruction choices.
export { useTransferInstructionAction } from './transfer-instruction-action';
export type {
  TransferInstructionActionKind,
  TransferInstructionActionRequest,
  UseTransferInstructionActionParameters,
  UseTransferInstructionActionReturnType,
} from './transfer-instruction-action';

// CIP-0056 typed allocation create: a typed specialization of useChoice for the
// AllocationInstructionV1 AllocationFactory_Allocate flow (the allocation sibling
// of useTransferInstruction).
export { useAllocationInstruction } from './allocation-instruction';
export type {
  AllocationInstructionRequest,
  UseAllocationInstructionParameters,
  UseAllocationInstructionReturnType,
} from './allocation-instruction';

// CIP-0056 typed allocation action: execute transfer, cancel, or withdraw on a
// funded Allocation (the allocation sibling of useTransferInstructionAction).
export { useAllocationAction } from './allocation-action';
export type {
  AllocationActionKind,
  AllocationActionRequest,
  UseAllocationActionParameters,
  UseAllocationActionReturnType,
} from './allocation-action';

// CIP-0056 typed allocation-requests read: a settlement app's on-ledger request
// that wallets discover as leg-sender observers (the read sibling of
// useTransferInstructions).
export { useAllocationRequests } from './token-allocation-requests';
export type {
  TokenAllocationRequest,
  TokenAllocationRequestRef,
  UseAllocationRequestsParameters,
  UseAllocationRequestsReturnType,
} from './token-allocation-requests';

// CIP-0056 typed allocation-request response: reject or withdraw an allocation
// request (the action sibling of useTransferInstructionAction).
export { useAllocationRequestAction } from './allocation-request-action';
export type {
  AllocationRequestActionKind,
  AllocationRequestActionRequest,
  UseAllocationRequestActionParameters,
  UseAllocationRequestActionReturnType,
} from './allocation-request-action';

// Optimistic update + automatic rollback helper for the mutation hooks.
export { optimisticMutationOptions } from './use-optimistic';
export type {
  OptimisticMutationConfig,
  OptimisticContext,
} from './use-optimistic';

// Re-export the standard cost types from core for convenience.
export type { CostEstimation, TrafficCost, PaidTrafficCost } from '@partylayer/core';
