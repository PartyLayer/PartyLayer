import type { Metadata } from 'next';
import PartyLayerKitContent from './content';

const title = 'PartyLayerKit Component';
const description =
  'Zero-config React provider component for Canton wallet integration. Configure network, adapters, theming, and wallet icons with PartyLayerKit.';
const url = 'https://partylayer.xyz/docs/partylayer-kit';

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
    { '@type': 'ListItem', position: 3, name: 'PartyLayerKit' },
  ],
};

export default function PartyLayerKitPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PartyLayerKitContent />
    </>
  );
}
