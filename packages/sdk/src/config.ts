/**
 * Configuration types for CantonConnect SDK
 */

import type { NetworkId, WalletId, WalletAdapter } from '@cantonconnect/core';
import type {
  StorageAdapter,
  CryptoAdapter,
  TelemetryAdapter,
  LoggerAdapter,
} from '@cantonconnect/core';

/**
 * Default registry URL for CantonConnect
 * This points to the official registry endpoint.
 */
export const DEFAULT_REGISTRY_URL = 'https://registry.cantonconnect.xyz';

/**
 * Adapter class type (for instantiation)
 */
export type AdapterClass = new () => WalletAdapter;

/**
 * CantonConnect configuration
 */
export interface CantonConnectConfig {
  /** 
   * Registry URL (optional)
   * @default 'https://registry.cantonconnect.xyz/v1/wallets.json'
   */
  registryUrl?: string;
  /** Registry channel */
  channel?: 'stable' | 'beta';
  /** Default network */
  network: NetworkId;
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
   * const client = createCantonConnect({
   *   network: 'devnet',
   *   app: { name: 'My dApp' },
   *   // adapters not specified = all built-in adapters (Console, Loop, Cantor8)
   * });
   * 
   * // Custom: only specific adapters
   * import { ConsoleAdapter } from '@cantonconnect/sdk';
   * const client = createCantonConnect({
   *   adapters: [new ConsoleAdapter()], // Only Console Wallet
   *   // ...
   * });
   * 
   * // With Bron (enterprise wallet with OAuth)
   * import { BronAdapter, getBuiltinAdapters } from '@cantonconnect/sdk';
   * const client = createCantonConnect({
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
  /** Telemetry adapter (optional) */
  telemetry?: TelemetryAdapter;
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
