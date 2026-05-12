import type { Metadata } from 'next';
import SendContent from './content';

const title = 'Send';
const description =
  'PartyLayer adapter for the Send Canton wallet. CIP-0103 native via Sigilry, mainnet-only, with registry-driven detection so Send and other splice-wallet-kernel extensions coexist safely at window.canton.';
const url = 'https://partylayer.xyz/docs/wallets/send';

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
    { '@type': 'ListItem', position: 3, name: 'Wallets & Adapters', item: 'https://partylayer.xyz/docs/wallets' },
    { '@type': 'ListItem', position: 4, name: 'Send' },
  ],
};

export default function SendWalletPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SendContent />
    </>
  );
}
