import type { Metadata } from 'next';
import WagmiForCantonContent from './content';

const title = 'wagmi for Canton developers';
const description =
  'Map the wagmi mental model onto Canton honestly: what ports mechanically, and the seven places the analogy breaks, including why there is no useReadContract when there is no public state and why useSwitchChain has no working equivalent today.';
const url = 'https://partylayer.xyz/docs/wagmi-for-canton';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: title,
  description,
  url,
  proficiencyLevel: 'Intermediate',
  dependencies: '@partylayer/react',
  author: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
  publisher: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
  about: [
    { '@type': 'Thing', name: 'Canton Network' },
    { '@type': 'SoftwareSourceCode', name: 'wagmi', codeRepository: 'https://github.com/wevm/wagmi' },
  ],
  citation: ['https://wagmi.sh/react/api/hooks'],
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://partylayer.xyz/' },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: 'https://partylayer.xyz/docs' },
    { '@type': 'ListItem', position: 3, name: 'wagmi for Canton' },
  ],
};

export default function WagmiForCantonPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <WagmiForCantonContent />
    </>
  );
}
