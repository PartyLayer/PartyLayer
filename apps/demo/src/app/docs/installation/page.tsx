import type { Metadata } from 'next';
import InstallationContent from './content';

const title = 'Installation Guide';
const description =
  'Install PartyLayer SDK via npm, pnpm, or yarn. Peer dependencies, React setup, and Vanilla JS configuration for Canton wallet integration.';
const url = 'https://partylayer.xyz/docs/installation';

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
    { '@type': 'ListItem', position: 3, name: 'Installation' },
  ],
};

export default function InstallationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <InstallationContent />
    </>
  );
}
