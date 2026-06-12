import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://partylayer.xyz'),
  title: {
    default: 'PartyLayer — One SDK for Every Canton Wallet',
    template: '%s | PartyLayer',
  },
  description:
    'Open-source wallet integration SDK for Canton Network. Connect Console Wallet, 5N Loop, Cantor8, Nightly, and Bron with a single unified API. React hooks, Vanilla JS, CIP-0103 support, and registry-backed wallet verification.',
  keywords: [
    'Canton wallet',
    'Canton Network',
    'Canton SDK',
    'wallet integration',
    'Canton dApp',
    'CIP-0103',
    'institutional wallet',
    'Console Wallet',
    '5N Loop',
    'Cantor8',
    'Nightly wallet',
    'Bron wallet',
    'PartyLayer',
    'wallet SDK',
    'React wallet hooks',
    'blockchain wallet',
    'DeFi wallet',
    'Canton blockchain',
    'wallet adapter',
    'wallet registry',
  ],
  icons: {
    icon: '/favicon-new.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'PartyLayer',
    locale: 'en_US',
    url: 'https://partylayer.xyz',
    title: 'PartyLayer — One SDK for Every Canton Wallet',
    description:
      'Open-source wallet integration SDK for Canton Network. Connect any Canton wallet with a single unified API.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'PartyLayer — One SDK for Every Canton Wallet',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@partylayerkit',
    title: 'PartyLayer — One SDK for Every Canton Wallet',
    description:
      'Open-source wallet integration SDK for Canton Network. Connect any Canton wallet with a single unified API.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://partylayer.xyz',
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PartyLayer',
  url: 'https://partylayer.xyz',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://partylayer.xyz/docs/introduction?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PartyLayer',
  url: 'https://partylayer.xyz',
  // Raster (PNG) absolute URL — Google's logo structured data requires a raster.
  logo: 'https://partylayer.xyz/logo.png',
  sameAs: [
    'https://github.com/PartyLayer',
    'https://x.com/partylayerkit',
    'https://www.npmjs.com/org/partylayer',
  ],
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'PartyLayer',
  url: 'https://partylayer.xyz',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'CIP-0103 compliant wallet integration SDK for the Canton Network — registry-backed, verified wallets, and a clean developer experience.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        {/*
          CIP-0103 test wallet — injected BEFORE React hydrates so it
          mimics a real browser extension's content-script timing.
          Used by:
            • E2E suite (apps/demo/e2e/helpers.ts → "Canton Demo Wallet")
            • Local dev visitors who don't have a real Canton extension
              installed and want to exercise the connect flow

          DEV-ONLY: the script is omitted from production builds so we
          never inject a synthetic wallet into real users' window.canton
          namespace. Production visitors see ONLY their installed
          extensions (or none, with proper Install CTAs). Verified in
          packages/react/src/native-readiness.test.ts (scenario K).
        */}
        {process.env.NODE_ENV !== 'production' && (
          <Script
            src="/mock-cip0103-wallet.js"
            strategy="beforeInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
