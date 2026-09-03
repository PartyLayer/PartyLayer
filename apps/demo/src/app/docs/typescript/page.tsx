import type { Metadata } from 'next';
import TypescriptContent from './content';

const title = 'TypeScript Types';
const description =
  'Full TypeScript type reference for PartyLayer SDK: branded types (WalletId, PartyId), session interfaces, signing types, capabilities, and event types.';
const url = 'https://partylayer.xyz/docs/typescript';

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
    { '@type': 'ListItem', position: 3, name: 'TypeScript Types' },
  ],
};

export default function TypescriptPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <TypescriptContent />
    </>
  );
}
