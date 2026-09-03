import type { Metadata } from 'next';
import WalletsContent from './content';

const title = 'Wallets & Adapters';
const description =
  'Built-in Canton wallet adapters: Console Wallet, 5N Loop, Cantor8, Nightly, and Bron. Custom adapter interface, wallet discovery, and registry integration.';
const url = 'https://partylayer.xyz/docs/wallets';

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
    { '@type': 'ListItem', position: 3, name: 'Wallets & Adapters' },
  ],
};

export default function WalletsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <WalletsContent />
    </>
  );
}
