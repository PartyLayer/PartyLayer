import type { Metadata } from 'next';
import ObservabilityContent from './content';

const title = 'Observability';
const description =
  'Vendor neutral telemetry and logging for PartyLayer: write an adapter for OpenTelemetry, Sentry, or Datadog, keep payloads privacy safe, and instrument the token standard path.';
const url = 'https://partylayer.xyz/docs/observability';

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
    { '@type': 'ListItem', position: 3, name: 'Observability' },
  ],
};

export default function ObservabilityPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ObservabilityContent />
    </>
  );
}
