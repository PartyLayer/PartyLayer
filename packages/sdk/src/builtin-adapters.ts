/**
 * Built-in wallet adapters
 * 
 * These adapters are automatically registered when creating a PartyLayer client.
 * dApp developers don't need to install or configure these separately.
 */

import type { WalletAdapter } from '@partylayer/core';
import { ConsoleAdapter } from '@partylayer/adapter-console';
import { LoopAdapter } from '@partylayer/adapter-loop';
import { Cantor8Adapter } from '@partylayer/adapter-cantor8';
import { NightlyAdapter } from '@partylayer/adapter-nightly';

// Note: BronAdapter requires OAuth config and is not included by default.
// Import it separately: import { BronAdapter } from '@partylayer/adapter-bron';

/**
 * Get all built-in adapters
 * 
 * This function returns instances of all supported wallet adapters.
 * Called automatically by createPartyLayer() unless custom adapters are provided.
 * 
 * Included adapters:
 * - ConsoleAdapter: Console Wallet browser extension
 * - LoopAdapter: 5N Loop mobile/web wallet
 * - Cantor8Adapter: Cantor8 wallet with deep link transport
 * - NightlyAdapter: Nightly multichain wallet with Canton support
 *
 * Note: BronAdapter is NOT included by default because it requires OAuth configuration.
 * To use Bron, install @partylayer/adapter-bron and register it manually.
 */
export function getBuiltinAdapters(): WalletAdapter[] {
  return [
    new ConsoleAdapter(),   // Console Wallet - browser extension
    new LoopAdapter(),      // 5N Loop - QR code / popup
    new Cantor8Adapter(),   // Cantor8 - deep link transport
    new NightlyAdapter(),   // Nightly - multichain wallet (injected)
  ];
}

/**
 * Built-in adapter classes (for advanced usage)
 */
export { ConsoleAdapter, LoopAdapter, Cantor8Adapter, NightlyAdapter };

/**
 * Re-export BronAdapter for convenience (requires config)
 * 
 * @example
 * ```typescript
 * import { BronAdapter } from '@partylayer/sdk';
 * 
 * const client = createPartyLayer({
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
export { BronAdapter } from '@partylayer/adapter-bron';
export type { BronAdapterConfig, BronAuthConfig, BronApiConfig } from '@partylayer/adapter-bron';
