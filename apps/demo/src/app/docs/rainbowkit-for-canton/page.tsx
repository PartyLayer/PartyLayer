import type { Metadata } from 'next';
import Content from './content';

const title = 'RainbowKit for Canton: a React wallet connection guide';
const description = 'Looking for a RainbowKit-style wallet experience on Canton? Install PartyLayer once, add ConnectButton, and understand CIP-0103, wallet networks and transaction limits.';
const url = 'https://partylayer.xyz/docs/rainbowkit-for-canton';
export const metadata: Metadata = {
  title, description, alternates: { canonical: url },
  openGraph: { title, description, url }, twitter: { title, description },
};
const article = {
  '@context': 'https://schema.org', '@type': 'TechArticle', headline: title, description, url,
  author: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz' },
  citation: ['https://rainbowkit.com/docs/installation', 'https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md'],
};
export default function Page() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} /><Content /></>;
}
