/**
 * Real PartyLayer connect wiring for the marketing site.
 *
 * Mirrors the demo's setup (apps/demo/src/lib/canton-demo-adapter.ts +
 * walletconnect-demo.ts) so the marketing "Connect Wallet" CTA opens the SAME
 * real @partylayer/react modal the demo uses — single-source wallet order
 * (from design/tokens `wallets`, already WC-4th), A1/A1b network-safety, and
 * registry-backed detection, with no mock drift.
 */
import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import { getBuiltinAdapters } from '@partylayer/sdk';
import type { WalletAdapter } from '@partylayer/core';
import { wallets } from '@/design/tokens';

/** Local-dev fallback projectId (override with VITE_WC_PROJECT_ID). */
const FALLBACK_WC_PROJECT_ID = '577414f6b46f09a7383d3c306c013a57';

/**
 * Opt-in WalletConnect adapter. `chainId` is left UNSET so A1 derives the CAIP-2
 * chain from the configured network (kit `network` prop → ctx.network).
 */
function buildWalletConnectAdapter(): WalletAdapter {
  const projectId =
    (import.meta.env?.VITE_WC_PROJECT_ID as string | undefined) || FALLBACK_WC_PROJECT_ID;
  return new WalletConnectAdapter({
    projectId,
    metadata: {
      name: 'PartyLayer',
      description: 'PartyLayer — one SDK for every Canton wallet',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://partylayer.xyz',
      icons: ['https://partylayer.xyz/icon.png'],
    },
  });
}

/** Built-in adapters + opt-in WalletConnect (same set the demo registers). */
export function buildMarketingAdapters(): WalletAdapter[] {
  return [...getBuiltinAdapters(), buildWalletConnectAdapter()];
}

/**
 * Wallet display order — derived from the canonical `wallets` source in
 * design/tokens (already WC-4th), so the real modal matches the demo and the
 * marketing showcase without drift.
 */
export const MARKETING_WALLET_ORDER: readonly string[] = wallets.map((w) => w.id);

/** Marketing wallet logos by id, so the real modal renders the site's logos. */
export const MARKETING_WALLET_ICONS: Record<string, string> = Object.fromEntries(
  wallets.map((w) => [w.id, w.logo]),
);

/**
 * Production registry CDN (the demo uses a local `/registry` proxy; the public
 * marketing site points at the published registry — also the SDK default).
 */
export const MARKETING_REGISTRY_URL = 'https://registry.partylayer.xyz';
