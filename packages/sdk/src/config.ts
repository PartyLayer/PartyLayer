/**
 * Configuration types for PartyLayer SDK
 */

import type { NetworkId, WalletId, WalletAdapter } from '@partylayer/core';
import type {
  StorageAdapter,
  CryptoAdapter,
  TelemetryAdapter,
  LoggerAdapter,
} from '@partylayer/core';

/**
 * Default registry URL for PartyLayer
 * This points to the official registry endpoint.
 */
export const DEFAULT_REGISTRY_URL = 'https://registry.partylayer.xyz';

/**
 * Telemetry configuration for opt-in metrics collection
 * 
 * @since 0.3.0
 */
export interface TelemetryConfig {
  /** 
   * Enable telemetry collection
   * @default false
   */
  enabled: boolean;
  
  /** 
   * Metrics backend endpoint URL
   * If not provided, metrics are collected but not sent
   */
  endpoint?: string;
  
  /**
   * Sampling rate (0.0 to 1.0)
   * @default 1.0 (100% of events)
   */
  sampleRate?: number;
  
  /**
   * Application identifier (will be hashed for privacy)
   * Used to calculate Monthly Active dApps (MAD)
   */
  appId?: string;
  
  /**
   * Include hashed origin in metrics
   * @default false
   */
  includeOrigin?: boolean;
  
  /**
   * Number of events to buffer before sending
   * @default 10
   */
  batchSize?: number;
  
  /**
   * Interval to flush metrics in milliseconds
   * @default 30000 (30 seconds)
   */
  flushIntervalMs?: number;
  
  /**
   * Network to include in metrics
   * If not provided, uses the SDK's configured network
   */
  network?: NetworkId;
}

/**
 * Adapter class type (for instantiation)
 */
export type AdapterClass = new () => WalletAdapter;

/**
 * PartyLayer configuration
 */
export interface PartyLayerConfig {
  /** 
   * Registry URL (optional)
   * @default 'https://registry.partylayer.xyz/v1/wallets.json'
   */
  registryUrl?: string;
  /** Registry channel */
  channel?: 'stable' | 'beta';
  /** Default network */
  network: NetworkId;
  /**
   * Network-mismatch enforcement policy (default: `'guard'`).
   *
   * When a connected wallet's effective network differs from `network`:
   * - `'off'`    — detect + emit `session:networkMismatch` only; never block.
   * - `'guard'`  — (default) block wrong-network TRANSACTIONS (signMessage,
   *   signTransaction, submitTransaction, ledgerApi); connect still succeeds.
   * - `'strict'` — also block CONNECT (throws `NetworkMismatchError`).
   *
   * BEHAVIOR CHANGE: prior to this, wrong-network transactions always
   * proceeded. Set `'off'` to restore that.
   */
  networkEnforcement?: 'off' | 'guard' | 'strict';
  /** 
   * Wallet adapters to register (OPTIONAL)
   * 
   * By default, ALL built-in adapters are automatically registered:
   * - ConsoleAdapter (Console Wallet - browser extension)
   * - LoopAdapter (5N Loop - QR code / popup)
   * - Cantor8Adapter (Cantor8 - deep link transport)
   * 
   * Note: BronAdapter requires OAuth config and is NOT included by default.
   * 
   * Only provide this if you want to customize which adapters to use.
   * 
   * @example
   * ```typescript
   * // Default: all adapters (recommended)
   * const client = createPartyLayer({
   *   network: 'devnet',
   *   app: { name: 'My dApp' },
   *   // adapters not specified = all built-in adapters (Console, Loop, Cantor8)
   * });
   * 
   * // Custom: only specific adapters
   * import { ConsoleAdapter } from '@partylayer/sdk';
   * const client = createPartyLayer({
   *   adapters: [new ConsoleAdapter()], // Only Console Wallet
   *   // ...
   * });
   * 
   * // With Bron (enterprise wallet with OAuth)
   * import { BronAdapter, getBuiltinAdapters } from '@partylayer/sdk';
   * const client = createPartyLayer({
   *   adapters: [
   *     ...getBuiltinAdapters(),
   *     new BronAdapter({ auth: {...}, api: {...} }),
   *   ],
   *   // ...
   * });
   * ```
   */
  adapters?: (WalletAdapter | AdapterClass)[];
  /** Storage adapter (default: browser localStorage-based encrypted) */
  storage?: StorageAdapter;
  /** Crypto adapter (default: WebCrypto) */
  crypto?: CryptoAdapter;
  /** Registry public keys for signature verification (ed25519) */
  registryPublicKeys?: string[];
  /** 
   * Telemetry configuration or adapter
   * 
   * Can be either:
   * - TelemetryConfig object for built-in metrics collection
   * - TelemetryAdapter instance for custom telemetry
   * 
   * @default undefined (telemetry disabled)
   * @since 0.3.0 - Added TelemetryConfig support
   */
  telemetry?: TelemetryAdapter | TelemetryConfig;
  /** Logger adapter (optional) */
  logger?: LoggerAdapter;
  /** Application metadata */
  app: {
    /** Application name */
    name: string;
    /** Origin (for origin binding checks, defaults to window.location.origin) */
    origin?: string;
  };
}

/**
 * Connect options
 */
export interface ConnectOptions {
  /** Specific wallet ID to connect to */
  walletId?: WalletId;
  /** Prefer installed wallets */
  preferInstalled?: boolean;
  /** Allow only specific wallets */
  allowWallets?: WalletId[];
  /** Required capabilities */
  requiredCapabilities?: string[];
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /**
   * Called with a pairing/display URI (e.g. a WalletConnect `wc:` URI) the
   * moment the adapter produces one, before approval. Used by the connect UI
   * to render a QR / deep-link. Adapters without such a URI never call it.
   */
  onDisplayUri?: (uri: string) => void;
}

/**
 * Wallet filter options
 */
export interface WalletFilter {
  /** Required capabilities */
  requiredCapabilities?: string[];
  /** Include experimental wallets */
  includeExperimental?: boolean;
}
