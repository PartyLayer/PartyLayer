import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://partylayer.xyz';

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/kit-demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/introduction`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/installation`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/quick-start`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/partylayer-kit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/connect-button`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/wallet-modal`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/theming`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/hooks`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/vanilla-js`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/wallets`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/docs/cip-0103`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/error-handling`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/typescript`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/docs/wallet-balances`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/token-transfers`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs/advanced`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
