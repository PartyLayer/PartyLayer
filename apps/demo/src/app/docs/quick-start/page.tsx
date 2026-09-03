import type { Metadata } from 'next';
import QuickStartContent from './content';

const title = 'Canton dApp quickstart: zero to a working wallet connection';
const description =
  'A working Canton dApp wallet connection in three steps, plus which Canton Network SDK you actually need, how to verify each stage succeeded, and what to do when it does not.';
const url = 'https://partylayer.xyz/docs/quick-start';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
};

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Connect a wallet in a Canton dApp',
  description,
  url,
  totalTime: 'PT10M',
  tool: [{ '@type': 'HowToTool', name: '@partylayer/react' }],
  step: [
    { '@type': 'HowToStep', name: 'Install', url: `${url}#step-1`, text: 'Add @partylayer/react and its peer dependencies to a React app.' },
    { '@type': 'HowToStep', name: 'Wrap your app', url: `${url}#step-2`, text: 'Mount PartyLayerKit at the root and configure the network.' },
    { '@type': 'HowToStep', name: 'Add ConnectButton', url: `${url}#step-3`, text: 'Render ConnectButton to open the registry-backed wallet modal.' },
    { '@type': 'HowToStep', name: 'Verify it works', url: `${url}#verify`, text: 'Check the modal lists wallets, the wallet flow starts, and useAccount reports a party id.' },
  ],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <QuickStartContent />
    </>
  );
}
