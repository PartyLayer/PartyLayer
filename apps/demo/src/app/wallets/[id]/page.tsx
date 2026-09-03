import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllWalletIds,
  getRegistrySnapshot,
  getWallet,
  CAPABILITY_API,
} from '../../../lib/wallet-directory';

/**
 * /wallets/<id>, one integration page per registry wallet, from one template.
 *
 * generateStaticParams reads the registry, so adding a wallet to the registry
 * produces its page on the next build with no file written here. Whether that
 * page is indexable is decided by the content gate in lib/wallet-notes.ts: a
 * wallet with hand-written notes is indexed and listed in the sitemap, a wallet
 * without them renders for anyone who follows a link but is marked noindex,
 * because a page whose only content is its own registry row says nothing the
 * directory table does not already say.
 */

export function generateStaticParams(): { id: string }[] {
  return getAllWalletIds().map((id) => ({ id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const w = getWallet(params.id);
  if (!w) return {};

  const url = `https://partylayer.xyz/wallets/${w.id}`;

  if (w.documentedAt) {
    // Already documented elsewhere. Point the canonical at that page so the two
    // URLs never compete, and keep this one out of the index.
    return {
      title: { absolute: `${w.name} on Canton · PartyLayer` },
      description: `Registry entry for ${w.name}. The integration guide lives at ${w.documentedAt}.`,
      alternates: { canonical: `https://partylayer.xyz${w.documentedAt}` },
      robots: { index: false, follow: true },
    };
  }

  if (!w.indexable) {
    return {
      title: { absolute: `${w.name} on Canton · PartyLayer` },
      description: `Registry entry for ${w.name}: transport, networks and capability flags.`,
      alternates: { canonical: url },
      // No integration notes written yet, so nothing here earns a place in the
      // index. See lib/wallet-notes.ts.
      robots: { index: false, follow: true },
    };
  }

  const title = `${baseName(w.name)} wallet integration for Canton dApps`;
  const description = `Connect ${w.name} in a Canton dApp with PartyLayer: install ${w.adapterPackage}, construct the adapter, and know which calls it supports and which it does not.`;

  return {
    title: { absolute: `${title} · PartyLayer` },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

/**
 * Several registry names already end in "Wallet" (Console Wallet, Cauri Wallet,
 * OneSwap V2 Wallet). Appending the word again reads as a typo in the title and
 * the H1, so strip it before composing.
 */
function baseName(name: string): string {
  return name.replace(/\s+Wallet$/i, '');
}

const t = {
  fg: '#0B0F1A',
  border: 'rgba(15, 23, 42, 0.10)',
  muted: '#F5F6F8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  brand50: '#FFFBEB',
  brand600: '#E6B800',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  codeBg: '#1E293B',
  codeFg: '#E2E8F0',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: t.codeBg,
        color: t.codeFg,
        padding: '14px 16px',
        overflowX: 'auto',
        fontFamily: t.mono,
        fontSize: 13,
        lineHeight: 1.6,
        margin: '0 0 20px',
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

export default function WalletIntegrationPage({ params }: { params: { id: string } }) {
  const w = getWallet(params.id);
  if (!w) notFound();

  const snapshot = getRegistrySnapshot();
  const siblings = snapshot.wallets.filter((x) => x.indexable && x.id !== w.id);
  const note = w.note;

  const articleJsonLd = note
    ? {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `${baseName(w.name)} wallet integration for Canton dApps`,
        description: `How to connect ${w.name} in a Canton dApp using PartyLayer's ${w.adapterPackage} adapter.`,
        url: `https://partylayer.xyz/wallets/${w.id}`,
        proficiencyLevel: 'Beginner',
        dateModified: snapshot.publishedAt,
        author: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
        publisher: { '@type': 'Organization', name: 'PartyLayer', url: 'https://partylayer.xyz/' },
        about: { '@type': 'SoftwareApplication', name: w.name, url: w.homepage || undefined },
      }
    : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://partylayer.xyz/' },
      { '@type': 'ListItem', position: 2, name: 'Canton wallets', item: 'https://partylayer.xyz/wallets' },
      { '@type': 'ListItem', position: 3, name: w.name },
    ],
  };

  return (
    <>
      {articleJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <p style={{ fontSize: 13, color: t.slate500, margin: '0 0 12px' }}>
        <Link href="/wallets" style={{ color: t.slate600 }}>
          Canton wallets
        </Link>{' '}
        / {w.name}
      </p>

      <h1 style={{ fontSize: 34, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
        {note ? `${baseName(w.name)} wallet integration` : `${w.name} registry entry`}
      </h1>

      {note ? (
        <p style={{ fontSize: 18, color: t.slate600, maxWidth: '62ch', margin: '0 0 28px' }}>
          {note.summary}
        </p>
      ) : (
        <div
          style={{
            border: `1px solid ${t.warnBorder}`,
            background: t.warnBg,
            padding: '14px 16px',
            fontSize: 14,
            lineHeight: 1.6,
            color: t.slate700,
            margin: '0 0 28px',
          }}
        >
          {w.documentedAt ? (
            <p style={{ margin: 0 }}>
              The {w.name} integration guide lives at{' '}
              <Link href={w.documentedAt}>{w.documentedAt}</Link>. This page carries only the
              registry entry and defers to that one, so the two never compete for the same subject.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              No integration notes have been written for {w.name} yet, so this page carries only its
              registry entry and is not indexed. Its registry entry names a third-party adapter
              rather than a PartyLayer one, so it is driven through the generic discovery path. See{' '}
              <Link href="/docs/generic-bridge">Generic bridge</Link> for how that path works, and{' '}
              <Link href="/wallets">the directory</Link> for the full list.
            </p>
          )}
        </div>
      )}

      {/* Registry facts. Always shown, generated. */}
      <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>What the registry declares</h2>
      <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, marginBottom: 28 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
          <tbody>
            {[
              ['Transport', w.transportLabel],
              ['Adapter package', w.adapterPackage],
              ['SDK version', w.sdkVersion || 'not declared'],
              ['Networks', w.networks.join(', ')],
              [
                'CIP-0103',
                w.cip0103Native === true
                  ? `Native${w.cip0103Since ? `, since ${w.cip0103Since}` : ''}`
                  : w.cip0103Native === false
                    ? 'Declared not native'
                    : 'Not declared',
              ],
            ].map(([k, v]) => (
              <tr key={k}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '9px 12px',
                    borderBottom: `1px solid ${t.border}`,
                    background: t.muted,
                    width: 180,
                    fontSize: 13,
                    color: t.slate600,
                    fontWeight: 600,
                  }}
                >
                  {k}
                </th>
                <td
                  style={{
                    padding: '9px 12px',
                    borderBottom: `1px solid ${t.border}`,
                    fontFamily: k === 'Adapter package' || k === 'Networks' ? t.mono : undefined,
                    fontSize: k === 'Adapter package' || k === 'Networks' ? 13 : 14,
                  }}
                >
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {w.cip0103Evidence ? (
        <p style={{ fontSize: 14, color: t.slate600, margin: '0 0 28px' }}>
          The CIP-0103 marker is recorded with its evidence:{' '}
          <a href={w.cip0103Evidence}>{w.cip0103Evidence}</a>. That link is the source; this page
          does not restate what it says.
        </p>
      ) : null}

      {note ? (
        <>
          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Install</h2>
          <CodeBlock>{`npm install @partylayer/react ${note.installPackage}`}</CodeBlock>

          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Construct the adapter</h2>
          <CodeBlock>{note.construct}</CodeBlock>

          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Register it</h2>
          <p style={{ fontSize: 15, color: t.slate700, maxWidth: '62ch', margin: '0 0 16px' }}>
            Pass the adapter to <code style={{ fontFamily: t.mono, fontSize: 13 }}>PartyLayerKit</code>.
            Everything else, the button and the modal, is the same for every wallet.
          </p>
          <CodeBlock>{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <PartyLayerKit network="devnet" adapters={[${w.id}]}>
      <ConnectButton />
    </PartyLayerKit>
  );
}`}</CodeBlock>

          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Connection flow</h2>
          <p style={{ fontSize: 15, color: t.slate700, maxWidth: '62ch', margin: '0 0 24px', lineHeight: 1.7 }}>
            {note.connectionFlow}
          </p>

          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>What the transport means for you</h2>
          <p style={{ fontSize: 15, color: t.slate700, maxWidth: '62ch', margin: '0 0 24px', lineHeight: 1.7 }}>
            {note.transportImplication}
          </p>

          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>What this adapter supports</h2>
          <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, marginBottom: 24 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ background: t.muted }}>
                  {['Capability', 'Call', 'Through this adapter'].map((h) => (
                    <th
                      key={h}
                      style={{ textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.slate500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITY_API.map((cap) => (
                  <tr key={cap.key}>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}` }}>{cap.label}</td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, fontFamily: t.mono, fontSize: 13, color: t.slate600 }}>
                      {cap.api}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}` }}>
                      {w.capabilities[cap.key] ? 'Yes' : <span style={{ color: t.slate500 }}>Not available</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {note.notAvailable.length > 0 ? (
            <>
              <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Not available, and why</h2>
              <dl style={{ margin: '0 0 28px', fontSize: 15, color: t.slate700, lineHeight: 1.7 }}>
                {note.notAvailable.map((na) => (
                  <div key={na.what} style={{ marginBottom: 12 }}>
                    <dt style={{ fontWeight: 600, fontFamily: t.mono, fontSize: 14 }}>{na.what}</dt>
                    <dd style={{ margin: '2px 0 0', maxWidth: '62ch' }}>{na.why}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}

          {note.gotchas.length > 0 ? (
            <>
              <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Things that will catch you out</h2>
              {note.gotchas.map((g) => (
                <div
                  key={g.title}
                  style={{
                    border: `1px solid ${t.warnBorder}`,
                    background: t.warnBg,
                    padding: '13px 16px',
                    marginBottom: 12,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: t.slate700,
                    maxWidth: '72ch',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 4 }}>{g.title}</strong>
                  {g.body}
                </div>
              ))}
              <div style={{ marginBottom: 28 }} />
            </>
          ) : null}
        </>
      ) : null}

      {note && note.troubleshooting.length > 0 ? (
        <>
          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Troubleshooting</h2>
          <p style={{ fontSize: 15, color: t.slate700, maxWidth: '62ch', margin: '0 0 16px' }}>
            Every symptom below is a real rejection path in{' '}
            <code style={{ fontFamily: t.mono, fontSize: 13 }}>{w.adapterPackage}</code>, quoted from
            the adapter rather than reconstructed.
          </p>
          <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, marginBottom: 28 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14, minWidth: 680 }}>
              <thead>
                <tr style={{ background: t.muted }}>
                  {['Symptom', 'Cause', 'What to do'].map((h) => (
                    <th
                      key={h}
                      style={{ textAlign: 'left', padding: '9px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.slate500, whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {note.troubleshooting.map((tr) => (
                  <tr key={tr.symptom}>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top', fontFamily: t.mono, fontSize: 12.5, width: '32%' }}>
                      {tr.symptom}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top', color: t.slate700 }}>
                      {tr.cause}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top', color: t.slate700 }}>
                      {tr.fix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Related</h2>
      <ul style={{ fontSize: 15, color: t.slate700, lineHeight: 1.8, paddingLeft: 20, margin: '0 0 24px' }}>
        <li>
          <Link href="/docs/quick-start">Quick Start</Link> builds a working app around this adapter.
        </li>
        <li>
          <Link href="/docs/wallets">Wallets and adapters</Link> covers registration, discovery and
          custom adapters.
        </li>
        <li>
          <Link href="/docs/cip-0103">CIP-0103 provider</Link> is the standard behind the transports
          above.
        </li>
        {w.homepage ? (
          <li>
            <a href={w.homepage}>{w.name} homepage</a> for anything about the wallet itself. This
            page describes the PartyLayer adapter, not the wallet&apos;s own SDK.
          </li>
        ) : null}
      </ul>

      {siblings.length > 0 ? (
        <>
          <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>Other wallets</h2>
          <p style={{ fontSize: 15, margin: 0, lineHeight: 1.9 }}>
            {siblings.map((s, i) => (
              <span key={s.id}>
                <Link href={`/wallets/${s.id}`}>{s.name}</Link>
                {i < siblings.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </>
      ) : null}
    </>
  );
}
