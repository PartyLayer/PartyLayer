import type { Metadata } from 'next';
import PrivacyAndReadsContent from './content';

const title = 'Privacy and Reads';
const description =
  'How PartyLayer read hooks line up with Canton witness-based visibility, interface views, explicit disclosure, and per-party cache scoping.';
const url = 'https://partylayer.xyz/docs/privacy-and-reads';

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
    { '@type': 'ListItem', position: 3, name: 'Privacy and Reads' },
  ],
};

export default function PrivacyAndReadsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PrivacyAndReadsContent />
    </>
  );
}
