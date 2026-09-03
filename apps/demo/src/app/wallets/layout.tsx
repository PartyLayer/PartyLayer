import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Chrome for the generated /wallets tree.
 *
 * A server component with no client JavaScript: these pages are read, not
 * operated, and everything on them is known at build time. Design values mirror
 * the docs layout's tokens (apps/demo/src/app/docs/layout.tsx) so the two trees
 * look like one site without importing a client component into a server one.
 */

const t = {
  bg: '#FFFFFF',
  fg: '#0B0F1A',
  border: 'rgba(15, 23, 42, 0.10)',
  slate500: '#64748B',
  slate600: '#475569',
  font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

export default function WalletsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: t.bg, color: t.fg, fontFamily: t.font, minHeight: '100vh' }}>
      <header
        style={{
          borderBottom: `1px solid ${t.border}`,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{ fontWeight: 700, fontSize: 15, color: t.fg, textDecoration: 'none' }}
        >
          PartyLayer
        </Link>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/wallets" style={{ color: t.slate600, textDecoration: 'none' }}>
            Wallets
          </Link>
          <Link href="/docs" style={{ color: t.slate600, textDecoration: 'none' }}>
            Docs
          </Link>
          <Link href="/docs/quick-start" style={{ color: t.slate600, textDecoration: 'none' }}>
            Quick Start
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 72px' }}>{children}</main>

      <footer
        style={{
          borderTop: `1px solid ${t.border}`,
          padding: '24px',
          fontSize: 13,
          color: t.slate500,
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
        <p style={{ margin: 0 }}>
          Generated from the PartyLayer wallet registry.{' '}
          <Link href="/docs/wallets" style={{ color: t.slate600 }}>
            Wallets and adapters
          </Link>
          {' · '}
          <Link href="/docs/cip-0103" style={{ color: t.slate600 }}>
            CIP-0103 provider
          </Link>
          {' · '}
          <a
            href="https://github.com/PartyLayer/PartyLayer/tree/main/registry"
            style={{ color: t.slate600 }}
          >
            registry source
          </a>
        </p>
      </footer>
    </div>
  );
}
