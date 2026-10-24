import type { MetadataRoute } from 'next';
import { getIndexableWalletIds } from '../lib/wallet-directory';

export default function sitemap(): MetadataRoute.Sitemap {
  // Omit optional lastmod until content modification dates are reliable.
  // Build timestamps are not content updates. Google ignores priority/changefreq:
  // https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  const base = 'https://partylayer.xyz';

  // Generated from the registry, so a new wallet enters the sitemap on the next
  // build with nothing edited here. Only wallets past the content gate in
  // lib/wallet-notes.ts are listed; the rest render but are noindex.
  const walletPages: MetadataRoute.Sitemap = getIndexableWalletIds().map((id) => ({
    url: `${base}/wallets/${id}`,
  }));

  return [
    { url: base },
    { url: `${base}/kit-demo` },
    { url: `${base}/cost-demo` },
    { url: `${base}/wallets` },
    { url: `${base}/docs` },
    { url: `${base}/docs/installation` },
    { url: `${base}/docs/quick-start` },
    { url: `${base}/docs/partylayer-kit` },
    { url: `${base}/docs/connect-button` },
    { url: `${base}/docs/wallet-modal` },
    { url: `${base}/docs/theming` },
    { url: `${base}/docs/hooks` },
    { url: `${base}/docs/authentication` },
    { url: `${base}/docs/transaction-lifecycle` },
    { url: `${base}/docs/vanilla-js` },
    { url: `${base}/docs/wallets` },
    { url: `${base}/docs/wallets/send` },
    { url: `${base}/docs/cip-0103` },
    { url: `${base}/docs/generic-bridge` },
    { url: `${base}/docs/wagmi-for-canton` },
    { url: `${base}/docs/error-handling` },
    { url: `${base}/docs/typescript` },
    { url: `${base}/docs/wallet-balances` },
    { url: `${base}/docs/token-transfers` },
    { url: `${base}/docs/advanced` },
    { url: `${base}/docs/cookbook` },
    { url: `${base}/docs/dev-and-staging` },
    { url: `${base}/docs/partylayer-and-canton-topology` },
    { url: `${base}/docs/multi-party-patterns` },
    { url: `${base}/docs/privacy-and-reads` },
    { url: `${base}/docs/events` },
    { url: `${base}/docs/observability` },
    { url: `${base}/docs/performance` },
    { url: `${base}/docs/production-checklist` },
    { url: `${base}/docs/rainbowkit-for-canton` },
    { url: `${base}/docs/integration-support` },
    ...walletPages,
  ];
}
