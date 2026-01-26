/**
 * CantonConnect Client Initialization
 * 
 * This file demonstrates the SIMPLEST way to integrate CantonConnect.
 * Just import @cantonconnect/sdk - all wallet adapters are built-in!
 * 
 * NO need to:
 * - Install adapter packages separately
 * - Import and register adapters manually
 * - Load wallet SDKs (Loop SDK is lazy-loaded from CDN automatically)
 */

import { createCantonConnect } from '@cantonconnect/sdk';
import type { CantonConnectClient } from '@cantonconnect/sdk';

/**
 * Initialize CantonConnect client
 * 
 * This is ALL a dApp needs to do to support ALL wallets!
 * 
 * Configuration from environment variables:
 * - VITE_REGISTRY_URL: Registry server URL (default: http://localhost:3001)
 * - VITE_REGISTRY_CHANNEL: Channel to use (stable/beta, default: stable)
 * - VITE_NETWORK: Network name (devnet/testnet/mainnet, default: devnet)
 * 
 * @example
 * ```typescript
 * import { createClient } from './cantonconnect';
 * 
 * const client = createClient();
 * const wallets = await client.listWallets();  // All wallets available!
 * const session = await client.connect({ walletId: 'console' });
 * ```
 */
export function createClient(): CantonConnectClient {
  const registryUrl = import.meta.env.VITE_REGISTRY_URL || 'http://localhost:3001';
  const channel = (import.meta.env.VITE_REGISTRY_CHANNEL || 'stable') as 'stable' | 'beta';
  const network = (import.meta.env.VITE_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet';

  // That's it! All wallet adapters are automatically registered:
  // - Console Wallet (browser extension)
  // - 5N Loop (QR code / popup - SDK lazy-loaded from CDN)
  const client = createCantonConnect({
    registryUrl,
    channel,
    network,
    app: {
      name: 'Test DApp',
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
    // adapters: not needed! All built-in adapters are auto-registered
  });

  return client;
}
