import type { Metadata } from 'next';
import HomeContent from './content';

const title = 'PartyLayer — One SDK for Every Canton Wallet';
const description =
  'Open-source wallet integration SDK for Canton Network. Connect Console Wallet, 5N Loop, Cantor8, Nightly, and Bron with a single unified API. React hooks, Vanilla JS, CIP-0103 support, and registry-backed wallet verification.';
// Next.js normalizes this to the origin with no trailing slash in the emitted
// <link rel="canonical">; Google treats the two forms as the same URL.
const url = 'https://partylayer.xyz/';

export const metadata: Metadata = {
  alternates: { canonical: url },
  openGraph: { title, description, url },
};

export default function HomePage() {
  return <HomeContent />;
}
