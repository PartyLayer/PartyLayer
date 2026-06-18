import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PartyLayer Studio',
  description: 'Interactive pattern workbench for PartyLayer',
  icons: { icon: '/favicon-new.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
