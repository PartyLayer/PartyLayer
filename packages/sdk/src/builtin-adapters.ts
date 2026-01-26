/**
 * Built-in wallet adapters
 * 
 * These adapters are automatically registered when creating a CantonConnect client.
 * dApp developers don't need to install or configure these separately.
 */

import type { WalletAdapter } from '@cantonconnect/core';
import { ConsoleAdapter } from '@cantonconnect/adapter-console';
import { LoopAdapter } from '@cantonconnect/adapter-loop';
import { Cantor8Adapter } from '@cantonconnect/adapter-cantor8';

// Note: BronAdapter requires OAuth config and is not included by default.
// Import it separately: import { BronAdapter } from '@cantonconnect/adapter-bron';

/**
 * Get all built-in adapters
 * 
 * This function returns instances of all supported wallet adapters.
 * Called automatically by createCantonConnect() unless custom adapters are provided.
 * 
 * Included adapters:
 * - ConsoleAdapter: Console Wallet browser extension
 * - LoopAdapter: 5N Loop mobile/web wallet
 * - Cantor8Adapter: Cantor8 wallet with deep link transport
 * 
 * Note: BronAdapter is NOT included by default because it requires OAuth configuration.
 * To use Bron, install @cantonconnect/adapter-bron and register it manually.
 */
export function getBuiltinAdapters(): WalletAdapter[] {
  return [
    new ConsoleAdapter(),   // Console Wallet - browser extension
    new LoopAdapter(),      // 5N Loop - QR code / popup
    new Cantor8Adapter(),   // Cantor8 - deep link transport
  ];
}

/**
 * Built-in adapter classes (for advanced usage)
 */
export { ConsoleAdapter, LoopAdapter, Cantor8Adapter };

/**
 * Re-export BronAdapter for convenience (requires config)
 * 
 * @example
 * ```typescript
 * import { BronAdapter } from '@cantonconnect/sdk';
 * 
 * const client = createCantonConnect({
 *   // ... config
 *   adapters: [
 *     ...getBuiltinAdapters(),
 *     new BronAdapter({
 *       auth: { clientId: '...', redirectUri: '...', ... },
 *       api: { baseUrl: '...', getAccessToken: async () => '...' },
 *     }),
 *   ],
 * });
 * ```
 */
export { BronAdapter } from '@cantonconnect/adapter-bron';
export type { BronAdapterConfig, BronAuthConfig, BronApiConfig } from '@cantonconnect/adapter-bron';
