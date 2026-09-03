import type { Metadata } from 'next';
import ErrorHandlingContent from './content';

const title = 'Error Handling';
const description =
  'Handle Canton wallet errors gracefully. Error codes, try-catch patterns, error events, and recovery strategies for PartyLayer SDK.';
const url = 'https://partylayer.xyz/docs/error-handling';

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
    { '@type': 'ListItem', position: 3, name: 'Error Handling' },
  ],
};

export default function ErrorHandlingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ErrorHandlingContent />
    </>
  );
}
