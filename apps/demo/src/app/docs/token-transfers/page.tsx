import type { Metadata } from 'next';
import TokenTransfersContent from './content';

const title = 'Token Transfers';
const description =
  'Trigger token transfers on the Canton Network using the PartyLayer SDK. Sign and submit Daml commands through any connected wallet.';
const url = 'https://partylayer.xyz/docs/token-transfers';

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
    { '@type': 'ListItem', position: 3, name: 'Token Transfers' },
  ],
};

export default function TokenTransfersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <TokenTransfersContent />
    </>
  );
}
