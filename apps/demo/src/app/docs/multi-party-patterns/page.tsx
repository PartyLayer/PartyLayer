import type { Metadata } from 'next';
import MultiPartyPatternsContent from './content';

const title = 'Multi-Party Patterns';
const description =
  'Two-step transfers, atomic delivery versus payment, abort and release paths, and registry-mediated writes on Canton with PartyLayer.';
const url = 'https://partylayer.xyz/docs/multi-party-patterns';

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
    { '@type': 'ListItem', position: 3, name: 'Multi-Party Patterns' },
  ],
};

export default function MultiPartyPatternsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <MultiPartyPatternsContent />
    </>
  );
}
