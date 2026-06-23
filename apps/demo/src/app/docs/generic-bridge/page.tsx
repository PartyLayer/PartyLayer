import type { Metadata } from 'next';
import GenericBridgeContent from './content';

const title = 'Generic Bridge';
const description =
  'Adapterless CIP-0103 integration. Any wallet that implements CIP-0103 and announces itself is driven through one generic code path, with no per-wallet adapter to write or maintain.';
const url = 'https://partylayer.xyz/docs/generic-bridge';

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
    { '@type': 'ListItem', position: 3, name: 'Generic Bridge' },
  ],
};

export default function GenericBridgePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <GenericBridgeContent />
    </>
  );
}
