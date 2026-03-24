import type { Metadata } from 'next';
import WalletBalancesContent from './content';

const title = 'Wallet Balances';
const description =
  'Query token balances and holdings for any party on the Canton Network using the PartyLayer SDK and the Active Contract Set (ACS).';
const url = 'https://partylayer.xyz/docs/wallet-balances';

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
    { '@type': 'ListItem', position: 3, name: 'Wallet Balances' },
  ],
};

export default function WalletBalancesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <WalletBalancesContent />
    </>
  );
}
