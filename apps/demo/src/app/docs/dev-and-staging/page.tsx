import type { Metadata } from 'next';
import DevAndStagingContent from './content';

const title = 'Dev and Staging';
const description =
  'The practical path for integrating PartyLayer, from a zero-install look in Studio, through local development against a mock wallet, to a real connection on devnet, and on to staging and production.';
const url = 'https://partylayer.xyz/docs/dev-and-staging';

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
    { '@type': 'ListItem', position: 3, name: 'Dev and Staging' },
  ],
};

export default function DevAndStagingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DevAndStagingContent />
    </>
  );
}
