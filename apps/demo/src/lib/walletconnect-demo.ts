/**
 * Demo WalletConnect registration.
 *
 * Registers the opt-in `@partylayer/adapter-walletconnect` so "WalletConnect"
 * appears in the demo's connect modal. The published `@partylayer/react` modal
 * renders the pairing QR + mobile deep-link itself (via the adapter's
 * `onDisplayUri`) and suppresses dapp-sdk's blank popup — so the demo needs NO
 * `onUri` callback and NO QR/URI rendering of its own.
 *
 * Lazy-import safety: importing the WC adapter's ENTRY does NOT pull
 * `@canton-network/dapp-sdk` / `@walletconnect/*` — those load via the adapter's
 * dynamic `import()` at connect time, so registering WC does not move
 * sign-client into the demo's main bundle.
 */

import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import type { WalletAdapter } from '@partylayer/core';

/** Local-dev fallback projectId (override with NEXT_PUBLIC_WC_PROJECT_ID). */
const FALLBACK_PROJECT_ID = '577414f6b46f09a7383d3c306c013a57';

/**
 * Construct the demo's WalletConnect adapter. `projectId` comes from
 * `NEXT_PUBLIC_WC_PROJECT_ID` (with a local-dev fallback). `chainId` unset →
 * PartyLayer derives it from the configured network (kit `network` prop →
 * `ctx.network`), e.g. `network="devnet"` → `canton:da-devnet`.
 */
export function buildWalletConnectAdapter(): WalletAdapter {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || FALLBACK_PROJECT_ID;
  return new WalletConnectAdapter({
    projectId,
    metadata: {
      name: 'PartyLayer Demo',
      description: 'PartyLayer demo dApp — WalletConnect',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://partylayer.xyz',
      icons: ['https://partylayer.xyz/icon.png'],
    },
  });
}
