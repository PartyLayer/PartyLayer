import type { Metadata } from 'next';
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
    // No `url` here on purpose. openGraph.url is inherited by every descendant
    // route, so a value set at the root makes each page announce the homepage's
    // identity. Each route sets its own alongside its canonical.
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
  // No `alternates.canonical` here on purpose. Next.js inherits root metadata
  // into every route that does not override it, so a canonical set here made
  // /kit-demo, /cost-demo, /debug and /docs all declare themselves the homepage
  // (Search Console: "duplicate without user-selected canonical"). Every route
  // now derives its own from its own path.
};

// Minimal WebSite identity block (no SearchAction: the site has no query
// endpoint that executes a search, and Google requires SearchAction targets to
// actually run searches — a non-functional declaration would be dishonest).
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PartyLayer',
  url: 'https://partylayer.xyz',
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

          DEV-ONLY: the `process.env.NODE_ENV !== 'production'` guard below
          omits the script from production builds, so we never inject a
          synthetic wallet into real users' window.canton namespace.
          Production visitors see ONLY their installed extensions (or none,
          with proper Install CTAs).

          NOT UNIT-TESTED, deliberately. This block previously claimed the
          guard was verified by a named scenario in
          packages/react/src/native-readiness.test.ts. No such scenario exists,
          and nothing in that file mentions NODE_ENV. A comment citing a test
          that does not exist is worse than no comment, because it reads as
          verified.

          A unit test here would assert `process.env.NODE_ENV !== 'production'`,
          which tests Next's compile-time substitution rather than anything we
          wrote — the guard is a static constant the bundler eliminates. The
          only verification worth having is that the PRODUCTION BUNDLE contains
          no reference to mock-cip0103-wallet.js, which is a build-output
          assertion, not a unit test, and does not exist today. If that
          assurance is wanted, it belongs in the gate beside the other
          package-contents checks.

          A PLAIN synchronous script tag on purpose (not next/script
          beforeInteractive): in App Router dev mode, beforeInteractive is
          queued via self.__next_s and executed after hydration starts, so
          window.canton.demoWallet raced React. Discovery/detect could run
          before the fixture existed, making the demo wallet report "not
          found" and the discovered-count flicker. A sync tag executes
          during HTML parse, strictly before hydration, like a real
          extension content script.
        */}
        {process.env.NODE_ENV !== 'production' && (
          <script src="/mock-cip0103-wallet.js" />
        )}
        {children}
      </body>
    </html>
  );
}
