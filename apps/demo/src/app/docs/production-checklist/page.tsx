import type { Metadata } from 'next';
import ProductionChecklistContent from './content';

const title = 'Production Migration Checklist';
const description =
  'The pre-production checklist for PartyLayer dApps: network promotion, bundle budgets, cache configuration, error boundaries, observability, synchronizer failover, cost accuracy, SSR, and framework parity.';
const url = 'https://partylayer.xyz/docs/production-checklist';

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
    { '@type': 'ListItem', position: 3, name: 'Production Checklist' },
  ],
};

export default function ProductionChecklistPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ProductionChecklistContent />
    </>
  );
}
