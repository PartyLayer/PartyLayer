import type { Metadata } from 'next';
import VanillaJsContent from './content';

const title = 'Vanilla JS SDK';
const description =
  'Use PartyLayer without React. JavaScript client API for Canton wallet connection, message signing, transaction submission, and real-time events.';
const url = 'https://partylayer.xyz/docs/vanilla-js';

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
    { '@type': 'ListItem', position: 3, name: 'Vanilla JS' },
  ],
};

export default function VanillaJsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <VanillaJsContent />
    </>
  );
}
