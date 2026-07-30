import type { Metadata } from 'next';
import EventsContent from './content';

const title = 'Event Spec';
const description =
  'Typed event payloads emitted by the PartyLayer SDK, with triggers, metric mappings, telemetry properties, and privacy guarantees for Canton dApps.';
const url = 'https://partylayer.xyz/docs/events';

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
    { '@type': 'ListItem', position: 3, name: 'Event Spec' },
  ],
};

export default function EventsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <EventsContent />
    </>
  );
}
