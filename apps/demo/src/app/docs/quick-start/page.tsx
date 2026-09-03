import type { Metadata } from 'next';
import QuickStartContent from './content';

const title = 'Quick Start';
const description =
  'Build your first Canton dApp with wallet connectivity in 3 steps. React tutorial with PartyLayerKit, ConnectButton, and WalletModal components.';
const url = 'https://partylayer.xyz/docs/quick-start';

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
    { '@type': 'ListItem', position: 3, name: 'Quick Start' },
  ],
};

export default function QuickStartPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <QuickStartContent />
    </>
  );
}
