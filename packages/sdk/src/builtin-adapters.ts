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
import { SendAdapter } from '@partylayer/adapter-send';

// Note: BronAdapter requires OAuth config and is not included by default.
// Import it separately: import { BronAdapter } from '@partylayer/adapter-bron';
// Note: CauriRemoteAdapter requires apiBase + walletUiBase config and is not
// included by default. Import it separately:
// import { CauriRemoteAdapter } from '@partylayer/adapter-cauri';

/**
 * Get all built-in adapters
 *
 * This function returns instances of all supported wallet adapters.
 * Called automatically by createPartyLayer() unless custom adapters are provided.
 *
 * Included adapters (returned by this function):
 * - LoopAdapter: 5N Loop mobile/web wallet
 * - Cantor8Adapter: Cantor8 wallet with deep link transport
 * - NightlyAdapter: Nightly multichain wallet with Canton support
 *
 * Served via the generic CIP-0103 announce path (registry transport:'announce'),
 * NOT in this default list — their adapters stay exported below for opt-in use:
 * - ConsoleAdapter: Console Wallet (browser extension + mobile). Defaults to
 *     'combined' mode; pass { target: 'local' } to restrict to extension-only.
 * - SendAdapter: Send Canton Wallet (passkey / WebAuthn-PRF).
 *
 * Note: BronAdapter is NOT included by default because it requires OAuth configuration.
 * To use Bron, install @partylayer/adapter-bron and register it manually.
 */
export function getBuiltinAdapters(): WalletAdapter[] {
  return [
    new LoopAdapter(),      // 5N Loop - QR code / popup
    new Cantor8Adapter(),   // Cantor8 - deep link transport
    new NightlyAdapter(),   // Nightly - multichain wallet (injected)
    // Console is served via the generic CIP-0103 announce path (registry
    // transport:'announce') — no longer in defaults; ConsoleAdapter stays
    // exported below for opt-in manual/bespoke use.
    // Send is served via the generic CIP-0103 announce path (registry
    // transport:'announce') — no longer in defaults; SendAdapter stays exported
    // below for opt-in manual/bespoke use.
  ];
}

/**
 * Built-in adapter classes (for advanced usage)
 */
export { ConsoleAdapter, LoopAdapter, Cantor8Adapter, NightlyAdapter, SendAdapter };

/**
 * Re-export Console adapter types for convenience
 */
export type { ConsoleAdapterConfig, ConsoleConnectionTarget } from '@partylayer/adapter-console';

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

/**
 * Re-export CauriRemoteAdapter for convenience (requires config).
 */
export { CauriRemoteAdapter } from '@partylayer/adapter-cauri';
export type { CauriRemoteAdapterConfig } from '@partylayer/adapter-cauri';
