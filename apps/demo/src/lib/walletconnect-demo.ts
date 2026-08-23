/**
 * Demo WalletConnect configuration.
 *
 * The adapter itself is constructed by the shared set in
 * `@partylayer/demo-adapters`; this module supplies the two values that are
 * specific to this app. It cannot live in the shared module: Next inlines
 * `process.env.NEXT_PUBLIC_*` at build time and Vite inlines
 * `import.meta.env.VITE_*`, so neither expression survives the other bundler.
 *
 * The published `@partylayer/react` modal renders the pairing QR and mobile
 * deep-link itself (via the adapter's `onDisplayUri`) and suppresses dapp-sdk's
 * blank popup, so the demo needs NO `onUri` callback and NO QR/URI rendering of
 * its own.
 *
 * Lazy-import safety: importing the WC adapter's ENTRY does NOT pull
 * `@canton-network/dapp-sdk` / `@walletconnect/*`. Those load via the adapter's
 * dynamic `import()` at connect time, so registering WC does not move
 * sign-client into the demo's main bundle.
 */

import type { WalletConnectMetadata } from '@partylayer/demo-adapters';

/** Local-dev fallback projectId (override with NEXT_PUBLIC_WC_PROJECT_ID). */
const FALLBACK_PROJECT_ID = '577414f6b46f09a7383d3c306c013a57';

/**
 * `projectId` from `NEXT_PUBLIC_WC_PROJECT_ID`, with a local-dev fallback.
 * `chainId` is never set here: PartyLayer derives it from the configured network
 * (kit `network` prop then `ctx.network`), e.g. `network="devnet"` gives
 * `canton:da-devnet`.
 */
export function wcProjectId(): string {
  return process.env.NEXT_PUBLIC_WC_PROJECT_ID || FALLBACK_PROJECT_ID;
}

/** Pairing metadata this demo presents to wallets. */
export const WC_METADATA: WalletConnectMetadata = {
  name: 'PartyLayer Demo',
  // Value preserved verbatim from before this refactor: it is pairing metadata
  // wallets see, so a code move must not alter it.
  description: 'PartyLayer demo dApp — WalletConnect',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://partylayer.xyz',
  icons: ['https://partylayer.xyz/icon.png'],
};
