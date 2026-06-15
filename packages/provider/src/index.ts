/**
 * @partylayer/provider
 *
 * CIP-0103 native Provider implementation for the Canton Network.
 *
 * This package provides:
 * - PartyLayerProvider: a CIP-0103-compliant Provider that routes
 *   requests to any native CIP-0103 wallet provider.
 * - Wallet discovery: scans for injected CIP-0103 providers.
 * - Error model: ProviderRpcError with EIP-1193 / EIP-1474 numeric codes.
 * - CAIP-2 network utilities.
 * - Backward-compatibility bridge from PartyLayerClient to Provider.
 */

// ─── Provider ───────────────────────────────────────────────────────────────

export { PartyLayerProvider } from './provider';
export type { PartyLayerProviderOptions } from './provider';

// ─── Bridge ─────────────────────────────────────────────────────────────────

export { createProviderBridge } from './bridge';
export type { BridgeableClient } from './bridge';

// ─── Errors ─────────────────────────────────────────────────────────────────

export {
  ProviderRpcError,
  RPC_ERRORS,
  JSON_RPC_ERRORS,
  userRejected,
  unauthorized,
  unsupportedMethod,
  disconnected,
  chainDisconnected,
  internalError,
  invalidParams,
  methodNotFound,
  resourceNotFound,
  resourceUnavailable,
  transactionRejected,
} from './errors';

// ─── Error Mapping ──────────────────────────────────────────────────────────

export { toProviderRpcError, toPartyLayerError } from './error-map';

// ─── Discovery ──────────────────────────────────────────────────────────────

export {
  discoverInjectedProviders,
  discoverAnnouncedProviders,
  discoverProviders,
  subscribeAnnouncedProviders,
  waitForAnnouncedProvider,
  waitForProvider,
  isCIP0103Provider,
} from './discovery';
export type {
  DiscoveredProvider,
  AnnouncedWallet,
  AnnounceDiscoveryOptions,
  AnnounceSubscribeOptions,
  WaitForAnnouncedOptions,
} from './discovery';
export { createExtensionChannelProvider } from './extension-channel';
export type { ExtensionChannelOptions } from './extension-channel';

// ─── Async Wallet ───────────────────────────────────────────────────────────

export { handleAsyncConnect, handleAsyncPrepareExecute } from './async-wallet';
export type {
  AsyncConnectOptions,
  AsyncPrepareExecuteOptions,
} from './async-wallet';

// ─── Network ────────────────────────────────────────────────────────────────

export {
  CANTON_NETWORKS,
  toCAIP2Network,
  fromCAIP2Network,
  isValidCAIP2,
} from './network';

// ─── Event Bus ──────────────────────────────────────────────────────────────

export { CIP0103EventBus } from './event-bus';

// ─── Method Router ──────────────────────────────────────────────────────────

export { MethodRouter } from './method-router';
export type { MethodHandler } from './method-router';

// ─── Re-export CIP-0103 types from core ─────────────────────────────────────

export type {
  CIP0103Provider,
  CIP0103EventListener,
  CIP0103RequestPayload,
  CIP0103RequestParams,
  CIP0103ConnectResult,
  CIP0103Network,
  CIP0103Account,
  CIP0103AccountStatus,
  CIP0103ProviderInfo,
  CIP0103ProviderType,
  CIP0103StatusEvent,
  CIP0103TxStatus,
  CIP0103TxChangedEvent,
  CIP0103TxPendingPayload,
  CIP0103TxSignedPayload,
  CIP0103TxExecutedPayload,
  CIP0103TxFailedPayload,
  CIP0103LedgerApiRequest,
  CIP0103LedgerApiResponse,
  CIP0103SignMessageRequest,
  CIP0103ProviderRpcError,
  CIP0103Method,
  CIP0103Event,
} from '@partylayer/core';

export {
  CIP0103_METHODS,
  CIP0103_MANDATORY_METHODS,
  CIP0103_EVENTS,
} from '@partylayer/core';
