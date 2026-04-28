import type { Metadata } from 'next';
import SendContent from './content';

const title = 'Send (Beta)';
const description =
  'Passkey-based Canton wallet by Send Foundation. CIP-0103 native via Sigilry, mainnet-only, with kernel.id namespace guard so Send and other splice-wallet-kernel extensions coexist safely at window.canton.';
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
    { '@type': 'ListItem', position: 4, name: 'Send (Beta)' },
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
