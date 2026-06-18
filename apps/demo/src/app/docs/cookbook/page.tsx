import type { Metadata } from 'next';
import CookbookContent from './content';

const title = 'Pattern Cookbook';
const description =
  'Eight runnable PartyLayer patterns for Canton wallets — connect, sign, submit, session reconnect/disconnect, React Query, multi-framework, error handling, and capability gating. Each links to a live, editable Studio scenario and a frank "when not to use" note.';
const url = 'https://partylayer.xyz/docs/cookbook';

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
    { '@type': 'ListItem', position: 3, name: 'Pattern Cookbook' },
  ],
};

export default function CookbookPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <CookbookContent />
    </>
  );
}
