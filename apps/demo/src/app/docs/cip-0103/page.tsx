import type { Metadata } from 'next';
import Cip0103Content from './content';

const title = 'CIP-0103: the Canton dApp Standard, implemented';
const description =
  'How CIP-0103 actually works: all ten methods with real request and response payloads read from the published upstream types, the event model, the full error taxonomy, how a dApp and a wallet each implement it, and how to verify compliance with our conformance runner.';
const url = 'https://partylayer.xyz/docs/cip-0103';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'CIP-0103: the Canton dApp Standard, implemented',
  description,
  url,
  proficiencyLevel: 'Intermediate',
  dependencies: '@partylayer/provider, @partylayer/conformance-runner',
  author: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
  publisher: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
  about: { '@type': 'Thing', name: 'CIP-0103', url: 'https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md' },
  citation: [
    'https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md',
    'https://www.npmjs.com/package/@canton-network/core-wallet-dapp-rpc-client',
  ],
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://partylayer.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://partylayer.xyz/docs' },
    { '@type': 'ListItem', position: 3, name: 'CIP-0103' },
  ],
};

export default function Cip0103Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Cip0103Content />
    </>
  );
}
