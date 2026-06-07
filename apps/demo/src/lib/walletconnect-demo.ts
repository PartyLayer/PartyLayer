/**
 * Demo-only WalletConnect registration for the live E2E scan test.
 *
 * Registers `@partylayer/adapter-walletconnect` (opt-in) so "WalletConnect"
 * appears in the demo's connect modal and opens a QR a real Canton WC wallet
 * (e.g. Nightly mobile) can scan.
 *
 * Lazy-import safety: this module statically imports only the WC adapter's
 * ENTRY, which does NOT pull `@canton-network/dapp-sdk` / `@walletconnect/*` —
 * those load via the adapter's dynamic `import()` at connect time. So merely
 * registering WC does not move sign-client into the demo's main bundle.
 *
 * QR display: the official adapter ALWAYS opens its own scannable QR popup
 * (dapp-sdk `showUriInPopup`) AND calls `onUri`. We additionally wire `onUri`
 * into the connect modal's existing QR seam (`#console-wallet-connect-placeholder`,
 * the same element @partylayer/react's modal scrapes for SDK-injected QRs), so
 * the pairing URI surfaces through the modal's QR path too.
 */

import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import type { WalletAdapter } from '@partylayer/core';

/** The DOM element id @partylayer/react's WalletModal scrapes for an injected QR SVG. */
const MODAL_QR_CONTAINER_ID = 'console-wallet-connect-placeholder';

/** Local-dev fallback projectId (override with NEXT_PUBLIC_WC_PROJECT_ID). */
const FALLBACK_PROJECT_ID = '577414f6b46f09a7383d3c306c013a57';

/** Render the WalletConnect pairing URI as a QR into the modal's QR seam. */
async function renderPairingQr(uri: string): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    const QRCode = await import('qrcode');
    const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 240 });
    let container = document.getElementById(MODAL_QR_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = MODAL_QR_CONTAINER_ID;
      document.body.appendChild(container);
    }
    container.innerHTML = svg;
  } catch (err) {
    // Non-fatal: the official adapter still shows its own QR popup.
    // eslint-disable-next-line no-console
    console.error('[demo] failed to render WalletConnect pairing QR', err);
  }
}

/**
 * Construct the demo's WalletConnect adapter. `projectId` comes from
 * `NEXT_PUBLIC_WC_PROJECT_ID` (with a local-dev fallback). `chainId` is left
 * unset (the official adapter defaults to `canton:devnet`).
 */
export function buildWalletConnectAdapter(): WalletAdapter {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || FALLBACK_PROJECT_ID;
  return new WalletConnectAdapter({
    projectId,
    metadata: {
      name: 'PartyLayer Demo',
      description: 'PartyLayer demo dApp — WalletConnect end-to-end test',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://partylayer.xyz',
      icons: ['https://partylayer.xyz/icon.png'],
    },
    onUri: (uri) => {
      void renderPairingQr(uri);
    },
  });
}
