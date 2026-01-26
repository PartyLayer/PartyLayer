/**
 * @cantonconnect/sdk
 * Main SDK for CantonConnect - Public API
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
export { createCantonConnect, CantonConnectClient } from './client';
// Internal API (for adapter registration - will be hidden in future)
export type { CantonConnectClient as _CantonConnectClientInternal } from './client';
export { DEFAULT_REGISTRY_URL } from './config';
export type { CantonConnectConfig, ConnectOptions, WalletFilter, AdapterClass } from './config';
export type {
  CantonConnectEvent,
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
} from '@cantonconnect/core';

// Re-export error types
export {
  CantonConnectError,
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
} from '@cantonconnect/core';
export type { ErrorCode } from '@cantonconnect/core';

// Re-export adapter types (for adapter developers)
export type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
} from '@cantonconnect/core';

// Re-export registry status type
export type { RegistryStatus } from '@cantonconnect/registry-client';

// Re-export built-in adapters (for advanced usage)
// dApps don't need to use these directly - they're auto-registered
export {
  ConsoleAdapter,
  LoopAdapter,
  Cantor8Adapter,
  BronAdapter,
  getBuiltinAdapters,
} from './builtin-adapters';

// Re-export Bron adapter config types (for advanced usage)
export type {
  BronAdapterConfig,
  BronAuthConfig,
  BronApiConfig,
} from './builtin-adapters';
