import type { Metadata } from 'next';
import ConnectButtonContent from './content';

const title = 'ConnectButton Component';
const description =
  'Drop-in wallet connect button for Canton dApps. Supports connected and disconnected states, custom labels, and responsive design.';
const url = 'https://partylayer.xyz/docs/connect-button';

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
    { '@type': 'ListItem', position: 3, name: 'ConnectButton' },
  ],
};

export default function ConnectButtonPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ConnectButtonContent />
    </>
  );
}
