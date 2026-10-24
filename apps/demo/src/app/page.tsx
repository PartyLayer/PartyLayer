import type { Metadata } from 'next';
import HomeContent from './content';

const title = 'PartyLayer — The Canton Wallet Connection Kit';
const description =
  'CIP-0103 compliant Canton wallet integration. Install the React kit once for supported wallet runtimes, a branded Connect Wallet button, themes and typed APIs.';
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
