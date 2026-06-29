import type { Metadata } from 'next';
import CantonTopologyContent from './content';

const title = 'PartyLayer and Canton Topology';
const description =
  'Where DAR files need to live when integrating PartyLayer. DAR placement is governed entirely by Canton topology, not by PartyLayer: PartyLayer is a CIP-0103 wallet connection SDK, not a validator and not a ledger bridge.';
const url = 'https://partylayer.xyz/docs/partylayer-and-canton-topology';

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
    { '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://partylayer.xyz/docs/introduction' },
    { '@type': 'ListItem', position: 3, name: 'PartyLayer and Canton Topology' },
  ],
};

export default function CantonTopologyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <CantonTopologyContent />
    </>
  );
}
