import type { Metadata } from 'next';

/**
 * Route-scoped metadata for /kit-demo. Without this the route inherits the root
 * layout's title, description and (previously) canonical, so it announced itself
 * as the homepage.
 */
const title = 'PartyLayerKit theming playground · PartyLayer';
const description =
  'Interactive playground for PartyLayerKit: switch theme families, accents, light/dark/auto modes and ConnectButton account states, and watch the connect UI update live.';
const url = 'https://partylayer.xyz/kit-demo';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
  twitter: { title, description },
};

export default function KitDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
