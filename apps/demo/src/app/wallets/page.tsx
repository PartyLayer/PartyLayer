import type { Metadata } from 'next';
import Link from 'next/link';
import { getRegistrySnapshot, CAPABILITY_API } from '../../lib/wallet-directory';

/**
 * /wallets, the Canton wallet directory, generated from the registry.
 *
 * Nothing on this page enumerates wallets by hand. Every row comes from
 * getRegistrySnapshot(), which reads the registry the demo itself serves, so a
 * new registry entry produces a new row on the next build.
 */

const title = 'Canton wallets: registry, transports and capabilities';
const description =
  'Every wallet in the PartyLayer registry, with the transport each one connects over, its adapter package, whether it is CIP-0103 native, the networks it reaches, and the capability flags that map to real SDK calls.';
const url = 'https://partylayer.xyz/wallets';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url },
  twitter: { title, description },
};

const t = {
  fg: '#0B0F1A',
  border: 'rgba(15, 23, 42, 0.10)',
  muted: '#F5F6F8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  brand50: '#FFFBEB',
  brand600: '#E6B800',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function formatDate(iso: string): string {
  // Fixed locale and UTC: this renders at build time, so a machine-dependent
  // format would make the output differ between builds.
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function WalletsDirectoryPage() {
  const snapshot = getRegistrySnapshot();
  const { wallets } = snapshot;

  const nativeCount = wallets.filter((w) => w.cip0103Native === true).length;
  const undeclaredCount = wallets.filter((w) => w.cip0103Native === undefined).length;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Canton wallets in the PartyLayer registry',
    description,
    numberOfItems: wallets.length,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    itemListElement: wallets.map((w, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: w.name,
      // Point at wherever the wallet is actually documented, so the list never
      // advertises a URL that is canonicalised elsewhere or noindex.
      url: w.documentedAt
        ? `https://partylayer.xyz${w.documentedAt}`
        : `https://partylayer.xyz/wallets/${w.id}`,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How many wallets support Canton through PartyLayer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The stable registry lists ${wallets.length} wallets. ${nativeCount} declare CIP-0103 native support with an evidence link, one declares it is not native, and ${undeclaredCount} declare nothing either way.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What does the transport column mean?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Transport is how a dApp reaches the wallet: a browser extension, a hosted popup, a mobile relay or deep link, a QR flow opened by the wallet SDK, or an enterprise API behind OAuth2. It is not stored in the registry. It is derived from each entry by the registry client, from the adapter transport and installation hints.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this list verified?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Each entry is checked against a JSON Schema on every build, and a gate asserts that wallets recorded as CIP-0103 native keep that flag. The registry is not cryptographically signed today. Capability flags describe what the PartyLayer adapter supports, not what a wallet vendor offers through their own SDK.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
        Canton wallets
      </h1>
      <p style={{ fontSize: 18, color: t.slate600, maxWidth: '62ch', margin: '0 0 8px' }}>
        Every wallet in the PartyLayer registry, with how a dApp reaches it, which adapter package
        drives it, and which capability flags map to which SDK calls.
      </p>
      <p style={{ fontSize: 15, color: t.slate500, maxWidth: '62ch', margin: '0 0 28px' }}>
        {wallets.length} wallets. {nativeCount} declare CIP-0103 native support, one declares it is
        not native, and {undeclaredCount} declare nothing either way.
      </p>

      {/* Provenance. Deliberately states what verification does and does not mean. */}
      <section
        style={{
          border: `1px solid ${t.border}`,
          background: t.muted,
          padding: '16px 18px',
          margin: '0 0 36px',
          fontSize: 14,
          lineHeight: 1.6,
          color: t.slate700,
        }}
      >
        <h2 style={{ fontSize: 14, margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase', color: t.slate500 }}>
          Where this comes from
        </h2>
        <p style={{ margin: '0 0 8px' }}>
          This page is generated from{' '}
          <code style={{ fontFamily: t.mono, fontSize: 13 }}>registry/v1/stable/registry.json</code>{' '}
          in the PartyLayer repository, on every deploy. It is not a hand-maintained list, so it
          cannot fall behind the registry it describes: if a wallet is added, its row and its page
          appear on the next build with nothing written by hand.
        </p>
        <p style={{ margin: '0 0 8px' }}>
          Registry sequence <strong>{snapshot.sequence}</strong>, channel{' '}
          <strong>{snapshot.channel}</strong>, published{' '}
          <strong>{formatDate(snapshot.publishedAt)}</strong> by {snapshot.publisher}. Schema version{' '}
          {snapshot.schemaVersion}.
        </p>
        <p style={{ margin: 0 }}>
          <strong>What checking means here, and what it does not.</strong> Every entry is validated
          against a JSON Schema on each build, and a gate asserts that wallets already recorded as
          CIP-0103 native keep that flag, because losing it silently downgrades detection. The
          registry carries <strong>no cryptographic signature today</strong>: the tooling exists in
          the repository but no signature ships with the published file, so do not read this list as
          cryptographically attested. Capability flags describe{' '}
          <strong>what the PartyLayer adapter supports</strong>, which is not the same as what a
          wallet vendor offers through their own SDK. For that, follow the wallet&apos;s own site.
        </p>
      </section>

      {/* Directory table */}
      <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, marginBottom: 36 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14, minWidth: 760 }}>
          <thead>
            <tr style={{ background: t.muted }}>
              {['Wallet', 'Transport', 'CIP-0103', 'Networks', 'Adapter package'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderBottom: `1px solid ${t.border}`,
                    fontSize: 12,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: t.slate500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.id}>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top' }}>
                  {w.indexable ? (
                    <Link href={`/wallets/${w.id}`} style={{ fontWeight: 600, color: t.fg }}>
                      {w.name}
                    </Link>
                  ) : w.documentedAt ? (
                    <Link href={w.documentedAt} style={{ fontWeight: 600, color: t.fg }}>
                      {w.name}
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{w.name}</span>
                  )}
                  <div style={{ color: t.slate500, fontSize: 13, marginTop: 2 }}>{w.description}</div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top' }}>
                  {w.transportLabel}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top' }}>
                  {w.cip0103Native === true ? (
                    <>
                      <span style={{ background: t.brand50, color: t.brand600, padding: '2px 7px', fontWeight: 600, fontSize: 12 }}>
                        Native
                      </span>
                      {w.cip0103Evidence ? (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          <a href={w.cip0103Evidence} style={{ color: t.slate600 }}>
                            evidence
                          </a>
                          {w.cip0103Since ? (
                            <span style={{ color: t.slate500 }}> · since {w.cip0103Since}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : w.cip0103Native === false ? (
                    <span style={{ color: t.slate600 }}>Not native</span>
                  ) : (
                    <span style={{ color: t.slate500 }}>Not declared</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top', fontFamily: t.mono, fontSize: 13 }}>
                  {w.networks.join(', ')}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, verticalAlign: 'top', fontFamily: t.mono, fontSize: 13 }}>
                  {w.adapterPackage}
                  {w.sdkVersion ? (
                    <div style={{ color: t.slate500, fontSize: 12 }}>{w.sdkVersion}</div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Capability matrix */}
      <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>Capabilities, and the call each one enables</h2>
      <p style={{ fontSize: 15, color: t.slate600, maxWidth: '62ch', margin: '0 0 16px' }}>
        A flag here is a statement about the PartyLayer adapter for that wallet. Where a flag is
        false, the corresponding call has no path through that adapter, so decide before you offer
        the wallet in a picker rather than after a user selects it.
      </p>
      <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, marginBottom: 36 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr style={{ background: t.muted }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.slate500 }}>
                Capability
              </th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.slate500 }}>
                Call
              </th>
              {wallets.map((w) => (
                <th
                  key={w.id}
                  style={{ textAlign: 'left', padding: '10px 8px', borderBottom: `1px solid ${t.border}`, fontSize: 12, color: t.slate500, whiteSpace: 'nowrap' }}
                >
                  {w.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_API.map((cap) => (
              <tr key={cap.key}>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, fontWeight: 600 }}>
                  {cap.label}
                </td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, fontFamily: t.mono, fontSize: 12, color: t.slate600 }}>
                  {cap.api}
                </td>
                {wallets.map((w) => (
                  <td
                    key={w.id}
                    style={{ padding: '9px 8px', borderBottom: `1px solid ${t.border}`, textAlign: 'center' }}
                  >
                    {w.capabilities[cap.key] ? (
                      <span aria-label="supported">Yes</span>
                    ) : (
                      <span style={{ color: t.slate500 }} aria-label="not available">
                        No
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 24, margin: '0 0 8px' }}>Next</h2>
      <ul style={{ fontSize: 15, color: t.slate700, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
        <li>
          <Link href="/docs/quick-start">Quick Start</Link> connects a wallet in a React app from
          nothing.
        </li>
        <li>
          <Link href="/docs/wallets">Wallets and adapters</Link> covers registering adapters,
          discovery and writing your own.
        </li>
        <li>
          <Link href="/docs/cip-0103">CIP-0103 provider</Link> is the standard most of these wallets
          speak.
        </li>
        <li>
          <Link href="/docs/generic-bridge">Generic bridge</Link> explains how a CIP-0103 wallet
          works with no adapter at all.
        </li>
      </ul>
    </>
  );
}
