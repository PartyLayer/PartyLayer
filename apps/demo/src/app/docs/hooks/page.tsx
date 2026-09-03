import type { Metadata } from 'next';
import HooksContent from './content';

const title = 'React Hooks API';
const description =
  'Complete React hooks reference for Canton dApps: useConnect, useSession, useDisconnect, useSignMessage, useWallets, useSubmitTransaction, and more.';
const url = 'https://partylayer.xyz/docs/hooks';

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
    { '@type': 'ListItem', position: 3, name: 'React Hooks' },
  ],
};

export default function HooksPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <HooksContent />
    </>
  );
}
