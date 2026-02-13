/**
 * @partylayer/sdk
 * Main SDK for PartyLayer - Public API
 * 
 * This package exports the public API that dApps should use.
 * All internal implementation details are hidden.
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 * - Signing transactions from dApps: https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html
 * - OpenRPC dApp API spec: https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json
 */

// Public API
export { createPartyLayer, PartyLayerClient } from './client';
// Backward compatibility aliases
export { createPartyLayer as createCantonConnect, PartyLayerClient as CantonConnectClient } from './client';
// Internal API (for adapter registration - will be hidden in future)
export type { PartyLayerClient as _PartyLayerClientInternal } from './client';
export { DEFAULT_REGISTRY_URL } from './config';
export type { PartyLayerConfig, PartyLayerConfig as CantonConnectConfig, ConnectOptions, WalletFilter, AdapterClass } from './config';
export type {
  PartyLayerEvent,
  PartyLayerEvent as CantonConnectEvent,
  EventHandler,
  RegistryUpdatedEvent,
  SessionConnectedEvent,
  SessionDisconnectedEvent,
  SessionExpiredEvent,
  TxStatusEvent,
  ErrorEvent,
} from './events';

// Re-export core types
export type {
  WalletId,
  PartyId,
  SessionId,
  NetworkId,
  CapabilityKey,
  WalletInfo,
  Session,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  TransactionStatus,
} from '@partylayer/core';

// Re-export error types
export {
  PartyLayerError,
  PartyLayerError as CantonConnectError,
  WalletNotFoundError,
  WalletNotInstalledError,
  UserRejectedError,
  OriginNotAllowedError,
  SessionExpiredError,
  CapabilityNotSupportedError,
  TransportError,
  RegistryFetchFailedError,
  RegistryVerificationFailedError,
  RegistrySchemaInvalidError,
  InternalError,
  TimeoutError,
} from '@partylayer/core';
export type { ErrorCode } from '@partylayer/core';

// Re-export adapter types (for adapter developers)
export type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
} from '@partylayer/core';

// Re-export registry status type
export type { RegistryStatus } from '@partylayer/registry-client';

// Re-export built-in adapters (for advanced usage)
// dApps don't need to use these directly - they're auto-registered
export {
  ConsoleAdapter,
  LoopAdapter,
  Cantor8Adapter,
  NightlyAdapter,
  BronAdapter,
  getBuiltinAdapters,
} from './builtin-adapters';

// Re-export Bron adapter config types (for advanced usage)
export type {
  BronAdapterConfig,
  BronAuthConfig,
  BronApiConfig,
} from './builtin-adapters';

// Telemetry and metrics (0.3.0+)
export type { TelemetryConfig } from './config';
export {
  MetricsTelemetryAdapter,
  createTelemetryAdapter,
  isTelemetryConfig,
} from './metrics-telemetry';

// Re-export metrics constants from core
export {
  METRICS,
  ENABLEMENT_METRICS,
  ERROR_METRICS,
  REGISTRY_METRICS,
  errorMetricName,
} from '@partylayer/core';
export type { MetricName, MetricsPayload } from '@partylayer/core';

// CIP-0103 Provider support
export {
  createProviderBridge,
  PartyLayerProvider,
  ProviderRpcError,
  RPC_ERRORS,
  JSON_RPC_ERRORS,
  discoverInjectedProviders,
  waitForProvider,
  isCIP0103Provider,
  CIP0103EventBus,
  toCAIP2Network,
  fromCAIP2Network,
  isValidCAIP2,
  CANTON_NETWORKS,
  CIP0103_METHODS,
  CIP0103_MANDATORY_METHODS,
  CIP0103_EVENTS,
} from '@partylayer/provider';

export type {
  CIP0103Provider,
  CIP0103ConnectResult,
  CIP0103StatusEvent,
  CIP0103Account,
  CIP0103Network,
  CIP0103TxChangedEvent,
  CIP0103TxStatus,
  CIP0103Method,
  CIP0103Event,
  DiscoveredProvider,
  PartyLayerProviderOptions,
} from '@partylayer/provider';
