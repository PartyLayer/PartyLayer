import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CantonConnect Demo',
  description: 'Demo dApp for CantonConnect SDK',
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
