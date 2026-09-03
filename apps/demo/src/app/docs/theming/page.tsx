import type { Metadata } from 'next';
import ThemingContent from './content';

const title = 'Theming Guide';
const description =
  'Customize PartyLayer with light, dark, and auto themes. Custom colors, border radius, font family, and CSS-in-JS design tokens for Canton wallet UI.';
const url = 'https://partylayer.xyz/docs/theming';

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
    { '@type': 'ListItem', position: 3, name: 'Theming' },
  ],
};

export default function ThemingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <ThemingContent />
    </>
  );
}
