import type { Metadata } from 'next';
import Cip0103Content from './content';

const title = 'CIP-0103 Provider';
const description =
  'Canton Improvement Proposal 0103 provider implementation. Standard dApp-wallet interface, RPC methods, provider events, and the asProvider() bridge.';
const url = 'https://partylayer.xyz/docs/cip-0103';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://partylayer.xyz' },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://partylayer.xyz/docs' },
    { '@type': 'ListItem', position: 3, name: 'CIP-0103 Provider' },
  ],
};

export default function Cip0103Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Cip0103Content />
    </>
  );
}
