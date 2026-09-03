import type { MetadataRoute } from 'next';
import { getIndexableWalletIds } from '../lib/wallet-directory';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://partylayer.xyz';

  // Generated from the registry, so a new wallet enters the sitemap on the next
  // build with nothing edited here. Only wallets past the content gate in
  // lib/wallet-notes.ts are listed; the rest render but are noindex.
  const walletPages: MetadataRoute.Sitemap = getIndexableWalletIds().map((id) => ({
    url: `${base}/wallets/${id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/kit-demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/cost-demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/wallets`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/installation`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/quick-start`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/partylayer-kit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/connect-button`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/wallet-modal`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/theming`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/hooks`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/vanilla-js`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/wallets`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/wallets/send`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/cip-0103`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/generic-bridge`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/wagmi-for-canton`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/error-handling`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/typescript`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/wallet-balances`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/token-transfers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/advanced`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/cookbook`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/dev-and-staging`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/partylayer-and-canton-topology`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/multi-party-patterns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/privacy-and-reads`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/events`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/observability`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/performance`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/production-checklist`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    ...walletPages,
  ];
}
