import type { Metadata } from 'next';
import AdvancedContent from './content';

const title = 'Advanced Guide';
const description =
  'Production deployment checklist, session persistence, custom storage adapters, registry internals, and security best practices for Canton dApps.';
const url = 'https://partylayer.xyz/docs/advanced';

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
    { '@type': 'ListItem', position: 3, name: 'Advanced' },
  ],
};

export default function AdvancedPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <AdvancedContent />
    </>
  );
}
