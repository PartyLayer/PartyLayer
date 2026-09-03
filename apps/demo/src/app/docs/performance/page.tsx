import type { Metadata } from 'next';
import PerformanceContent from './content';

const title = 'Performance';
const description =
  'Measured bundle sizes per package, size-limit budgets, tree shaking requirements, registry caching, and lazy loading for PartyLayer.';
const url = 'https://partylayer.xyz/docs/performance';

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
    { '@type': 'ListItem', position: 3, name: 'Performance' },
  ],
};

export default function PerformancePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PerformanceContent />
    </>
  );
}
