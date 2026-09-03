import type { Metadata } from 'next';

/**
 * Route-scoped metadata for /debug. This is an internal CIP-0103 discovery probe
 * with no reader-facing content, so it is explicitly excluded from indexing
 * rather than left to inherit the homepage's identity.
 */
const title = 'Discovery debug · PartyLayer';
const url = 'https://partylayer.xyz/debug';

export const metadata: Metadata = {
  title: { absolute: title },
  description: 'Internal CIP-0103 provider discovery probe. Not part of the documentation.',
  robots: { index: false, follow: false },
  alternates: { canonical: url },
};

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
