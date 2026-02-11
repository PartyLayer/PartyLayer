import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'PartyLayer Demo',
  description: 'Demo dApp for PartyLayer SDK',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/*
          CIP-0103 test wallet — injected before React hydrates.
          Simulates a real wallet extension injecting at window.canton.*
        */}
        <Script
          src="/mock-cip0103-wallet.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
