import type { Metadata } from 'next';
import IntroductionContent from './introduction/content';

/**
 * /docs IS the introduction. It used to be a server component calling
 * redirect('/docs/introduction'), which in a statically prerendered route
 * deployed as a 307 with NO Location header and Next.js's error shell as the
 * body — a dead end for crawlers on the URL people actually type and link to.
 * /docs/introduction now 301s here (see next.config.js).
 */
const title = 'Introduction';
const description =
  'PartyLayer is an open-source SDK for integrating Canton Network wallets into your dApp. Unified adapter interface, registry-backed wallet verification, and CIP-0103 support.';
const url = 'https://partylayer.xyz/docs';

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
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://partylayer.xyz/' },
    { '@type': 'ListItem', position: 2, name: 'Docs' },
  ],
};

export default function DocsIndexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <IntroductionContent />
    </>
  );
}
