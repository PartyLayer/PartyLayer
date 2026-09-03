import type { Metadata } from 'next';
import WalletModalContent from './content';

const title = 'WalletModal Component';
const description =
  'Wallet selection modal with automatic discovery, connection flow states, and error handling for Canton Network wallets.';
const url = 'https://partylayer.xyz/docs/wallet-modal';

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
    { '@type': 'ListItem', position: 3, name: 'WalletModal' },
  ],
};

export default function WalletModalPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <WalletModalContent />
    </>
  );
}
