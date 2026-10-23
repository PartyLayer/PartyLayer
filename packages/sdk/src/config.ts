/**
 * Configuration types for PartyLayer SDK
 */

import type { BronAdapterConfig } from '@partylayer/adapter-bron';
import type { WalletConnectAdapterConfig } from '@partylayer/adapter-walletconnect';

import type {
  NetworkId,
  WalletId,
  WalletAdapter,
  OfficialProviderAdapter,
  OfficialAdapterFactory,
} from '@partylayer/core';
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
   * Delay browser subscriptions and automatic restoration until initialize()
   * or the first explicit client action. Frameworks use this for render safety.
   * @default false
   */
  deferInitialization?: boolean;
  /**
   * Registry base URL (optional). The client appends `/v1/{channel}/registry.json`,
   * so the default fetch is `https://registry.partylayer.xyz/v1/stable/registry.json`.
   * @default 'https://registry.partylayer.xyz'
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
   * Replace the default wallet catalog. Omit for all supported wallets on the
   * configured network/channel. Official wallet SDKs are included and loaded
   * lazily; no per-wallet installation or registration is required.
   */
  adapters?: (
    | WalletAdapter
    | AdapterClass
    | OfficialProviderAdapter
    | OfficialAdapterFactory
  )[];
  /** Extend the default catalog with custom adapters (for example a test wallet). */
  additionalAdapters?: PartyLayerConfig['adapters'];
  /** Enable WalletConnect with your application's Cloud project id. */
  walletConnect?: WalletConnectAdapterConfig;
  /** Enable the Bron remote signer with your application's OAuth/API configuration. */
  bron?: BronAdapterConfig;
  /** Storage adapter (default: browser localStorage-based encrypted) */
  storage?: StorageAdapter;
  /** Crypto adapter (default: WebCrypto) */
  crypto?: CryptoAdapter;
  /** Registry public keys for signature verification (ed25519) */
  registryPublicKeys?: string[];
  /**
   * EIP-6963-style announce discovery — the canonical Canton provider contract
   * (`canton:requestProvider` → `canton:announceProvider`, see provider.md).
   *
   * When enabled, `listWallets()` aggregates announced CIP-0103 wallets with
   * the `window.canton` namespace scan, the registry, and registered adapters:
   *   - an announced id matching a registered/registry wallet's
   *     `providerDetection` (provider.id) maps to that adapter — NO duplicate
   *     picker entry (e.g. Console's announce `lpnf…` → the Console adapter);
   *   - an UNKNOWN announced id surfaces as a dynamic entry routed to its own
   *     extension `target` (collision-proof; future announce-capable wallets
   *     appear with zero code changes).
   *
   * Default ON in the browser; ALWAYS skipped under SSR (`typeof window` guard).
   * With zero announcers, `listWallets()` output is byte-identical to before.
   */
  discovery?: {
    /** Aggregate `canton:announceProvider` wallets. @default true (in browser) */
    announce?: boolean;
    /** Announce-collection window in ms. @default 300 (canonical ~300ms) */
    announceTimeoutMs?: number;
  };
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
  /**
   * Log verbosity. Filtering happens centrally in the client before the adapter is
   * called, so adapters never filter themselves. `silent` suppresses everything.
   * Defaults to `info` when a logger is supplied; with no logger the client is
   * silent regardless.
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
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
