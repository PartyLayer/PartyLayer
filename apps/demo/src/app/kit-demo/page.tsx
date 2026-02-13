'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import {
  PartyLayerKit,
  ConnectButton,
  useSession,
  useWallets,
  useSignMessage,
  usePartyLayer,
} from '@partylayer/react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ─── Design Tokens (light + dark, matching marketing/landing page) ──────────

const lightTokens = {
  bg: '#FFFFFF',
  fg: '#0B0F1A',
  muted: '#F5F6F8',
  muted2: '#EEF0F4',
  border: 'rgba(15, 23, 42, 0.10)',
  brand50: '#FFFBEB',
  brand100: '#FFF5CC',
  brand500: '#FFCC00',
  brand600: '#E6B800',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate900: '#0B0F1A',
  success: '#10B981',
  successBg: '#ecfdf5',
  successBorder: '#d1fae5',
  error: '#EF4444',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  cipBadgeBg: '#f3e8ff',
  cipBadgeColor: '#7c3aed',
  shadow: {
    card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03)',
    cardHover: '0 2px 8px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
    button: '0 1px 2px rgba(15, 23, 42, 0.05)',
  },
};

const darkTokens: typeof lightTokens = {
  bg: '#0B0F1A',
  fg: '#E2E8F0',
  muted: '#151926',
  muted2: '#1C2235',
  border: 'rgba(255, 255, 255, 0.08)',
  brand50: '#1A1608',
  brand100: '#2A2510',
  brand500: '#FFCC00',
  brand600: '#E6B800',
  slate300: '#475569',
  slate400: '#64748B',
  slate500: '#94A3B8',
  slate700: '#CBD5E1',
  slate900: '#F1F5F9',
  success: '#34D399',
  successBg: '#052E16',
  successBorder: '#065F46',
  error: '#F87171',
  errorBg: '#450A0A',
  errorBorder: '#7F1D1D',
  cipBadgeBg: '#2E1065',
  cipBadgeColor: '#C4B5FD',
  shadow: {
    card: '0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
    cardHover: '0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.2)',
    button: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
};

type Tokens = typeof lightTokens;
const TokensContext = createContext<Tokens>(lightTokens);
function useTokens(): Tokens { return useContext(TokensContext); }

const font = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
const textOnBrand = '#0B0F1A'; // always dark text on yellow brand buttons

// ─── Wallet Logo Map (matching marketing tokens exactly) ────────────────────

const WALLET_LOGOS: Record<string, string> = {
  console: '/wallets/console.png',
  loop: '/wallets/loop.svg',
  cantor8: '/wallets/cantor8.png',
  bron: '/wallets/bron.png',
  nightly: '/wallets/nightly.svg',
};

function getWalletLogo(walletId: string): string | null {
  const id = walletId.replace(/^cip0103:/, '');
  if (WALLET_LOGOS[id]) return WALLET_LOGOS[id];
  for (const [key, url] of Object.entries(WALLET_LOGOS)) {
    if (id.toLowerCase().includes(key)) return url;
  }
  return null;
}

// ─── Inner Content ──────────────────────────────────────────────────────────

function DemoContent() {
  const c = useTokens();
  const shadow = c.shadow;
  const session = useSession();
  const { wallets, isLoading } = useWallets();
  const { signMessage, isSigning, error: signError } = useSignMessage();
  const client = usePartyLayer();
  const [signResult, setSignResult] = useState<string | null>(null);

  const nativeWallets = wallets.filter((w) => w.metadata?.source === 'native-cip0103');
  const registryWallets = wallets.filter((w) => !w.metadata?.source);

  const handleSign = async () => {
    setSignResult(null);
    const result = await signMessage({ message: 'Hello Canton from PartyLayerKit!' });
    if (result) {
      setSignResult(String(result.signature));
    }
  };

  return (
    <>
      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <StatCard label="Total Wallets" value={isLoading ? '...' : String(wallets.length)} />
        <StatCard label="CIP-0103 Native" value={isLoading ? '...' : String(nativeWallets.length)} accent={c.brand600} />
        <StatCard label="Registry" value={isLoading ? '...' : String(registryWallets.length)} />
      </div>

      {/* Session Panel */}
      <PLCard style={{ marginBottom: '24px' }}>
        <PLCardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: session ? c.success : c.slate300,
            }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: c.fg }}>
              {session ? 'Active Session' : 'Session'}
            </span>
          </div>
        </PLCardHeader>
        <div style={{ padding: '20px' }}>
          {session ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InfoField label="Party ID" value={String(session.partyId)} mono />
              <InfoField label="Wallet" value={String(session.walletId)} />
              <InfoField label="Session ID" value={String(session.sessionId)} mono />
              <InfoField label="Network" value={session.network || 'devnet'} />
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: c.slate500, fontSize: '14px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={c.slate300} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginBottom: '8px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>Connect a wallet to start your session</div>
            </div>
          )}
        </div>
      </PLCard>

      {/* Wallet Discovery */}
      <PLCard style={{ marginBottom: '24px' }}>
        <PLCardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: c.fg }}>Discovered Wallets</span>
            <span style={{ fontSize: '0.875rem', color: c.slate500 }}>
              {isLoading ? 'Scanning...' : `${wallets.length} found`}
            </span>
          </div>
        </PLCardHeader>
        <div style={{ padding: '20px' }}>
          {isLoading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: `3px solid ${c.muted2}`,
                borderTop: `3px solid ${c.brand500}`,
                borderRadius: '50%',
                animation: 'kit-spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }} />
              <div style={{ color: c.slate500, fontSize: '14px' }}>Discovering wallets...</div>
            </div>
          ) : (
            <>
              {/* CIP-0103 Native */}
              {nativeWallets.length > 0 && (
                <div style={{ marginBottom: registryWallets.length > 0 ? '24px' : 0 }}>
                  <SectionLabel label="CIP-0103 Native" count={nativeWallets.length} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {nativeWallets.map((w) => (
                      <WalletCard
                        key={w.walletId}
                        name={w.name}
                        walletId={w.walletId}
                        capabilities={w.capabilities}
                        isNative
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Registry */}
              {registryWallets.length > 0 && (
                <div>
                  <SectionLabel label="Registry" count={registryWallets.length} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {registryWallets.map((w) => (
                      <WalletCard
                        key={w.walletId}
                        name={w.name}
                        walletId={w.walletId}
                        capabilities={w.capabilities}
                        website={w.website}
                      />
                    ))}
                  </div>
                </div>
              )}

              {wallets.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: c.slate500, fontSize: '14px' }}>
                  No wallets discovered. Install a CIP-0103 compatible wallet.
                </div>
              )}
            </>
          )}
        </div>
      </PLCard>

      {/* Interactive Tests (only when connected) */}
      {session && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Sign Message */}
          <PLCard>
            <PLCardHeader>
              <span style={{ fontSize: '1.25rem', fontWeight: 600, color: c.fg }}>Sign Message</span>
            </PLCardHeader>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '14px', color: c.slate500, margin: '0 0 16px', lineHeight: 1.5 }}>
                Test message signing with the connected wallet.
              </p>
              <button onClick={handleSign} disabled={isSigning} style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: isSigning ? c.muted2 : c.brand500,
                color: isSigning ? c.slate500 : textOnBrand,
                border: 'none',
                borderRadius: '10px',
                cursor: isSigning ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: font,
                boxShadow: shadow.button,
                transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}>
                {isSigning ? 'Signing...' : 'Sign "Hello Canton"'}
              </button>
              {signResult && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: c.successBg,
                  borderRadius: '10px',
                  border: `1px solid ${c.successBorder}`,
                }}>
                  <div style={{ fontSize: '11px', color: c.success, fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signature</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', color: c.slate700, lineHeight: 1.5 }}>
                    {signResult}
                  </div>
                </div>
              )}
              {signError && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: c.errorBg,
                  borderRadius: '10px',
                  border: `1px solid ${c.errorBorder}`,
                  fontSize: '13px',
                  color: c.error,
                }}>
                  {signError.message}
                </div>
              )}
            </div>
          </PLCard>

          {/* CIP-0103 Bridge */}
          <CIP0103BridgePanel client={client} />
        </div>
      )}
    </>
  );
}

// ─── CIP-0103 Bridge Test Panel ─────────────────────────────────────────────

function CIP0103BridgePanel({ client }: { client: ReturnType<typeof usePartyLayer> }) {
  const c = useTokens();
  const shadow = c.shadow;
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testBridge = async () => {
    setLoading(true);
    setBridgeStatus(null);
    try {
      const provider = (client as unknown as { asProvider: () => { request: (args: { method: string }) => Promise<unknown> } }).asProvider();
      const status = await provider.request({ method: 'status' });
      setBridgeStatus(JSON.stringify(status, null, 2));
    } catch (err) {
      setBridgeStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PLCard>
      <PLCardHeader>
        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: c.fg }}>CIP-0103 Bridge</span>
      </PLCardHeader>
      <div style={{ padding: '20px' }}>
        <p style={{ fontSize: '14px', color: c.slate500, margin: '0 0 16px', lineHeight: 1.5 }}>
          Test the CIP-0103 provider bridge interface.
        </p>
        <button onClick={testBridge} disabled={loading} style={{
          width: '100%',
          padding: '10px 16px',
          backgroundColor: loading ? c.muted2 : c.fg,
          color: loading ? c.slate500 : c.bg,
          border: 'none',
          borderRadius: '10px',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: font,
          boxShadow: shadow.button,
          transition: 'all 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          {loading ? 'Querying...' : 'Query provider.request("status")'}
        </button>
        {bridgeStatus && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: c.muted,
            borderRadius: '10px',
            border: `1px solid ${c.border}`,
          }}>
            <div style={{ fontSize: '11px', color: c.slate500, fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Response</div>
            <pre style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: c.slate700,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              maxHeight: '160px',
              overflow: 'auto',
            }}>
              {bridgeStatus}
            </pre>
          </div>
        )}
      </div>
    </PLCard>
  );
}

// ─── Reusable UI Components (matching marketing Card pattern) ───────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const c = useTokens();
  const shadow = c.shadow;
  return (
    <div style={{
      padding: '20px',
      borderRadius: '14px',
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      boxShadow: shadow.card,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '28px',
        fontWeight: 700,
        color: accent || c.fg,
        marginBottom: '4px',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', color: c.slate500, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function PLCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const c = useTokens();
  const shadow = c.shadow;
  return (
    <div style={{
      borderRadius: '14px',
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      boxShadow: shadow.card,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function PLCardHeader({ children }: { children: React.ReactNode }) {
  const c = useTokens();
  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: `1px solid ${c.border}`,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  const c = useTokens();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: c.fg, letterSpacing: '-0.01em' }}>
        {label}
      </span>
      <span style={{
        fontSize: '12px',
        color: c.slate500,
        backgroundColor: c.muted,
        padding: '2px 8px',
        borderRadius: '6px',
        fontWeight: 500,
      }}>
        {count}
      </span>
      <div style={{ flex: 1, height: '1px', backgroundColor: c.border }} />
    </div>
  );
}

function WalletCard({
  name,
  walletId,
  capabilities,
  isNative,
  website,
}: {
  name: string;
  walletId: string;
  capabilities: string[];
  isNative?: boolean;
  website?: string;
}) {
  const c = useTokens();
  const shadow = c.shadow;
  const logo = getWalletLogo(walletId);

  return (
    <div style={{
      padding: '16px',
      borderRadius: '10px',
      border: `1px solid ${c.border}`,
      backgroundColor: c.bg,
      transition: 'box-shadow 150ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      cursor: 'default',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = shadow.cardHover;
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Logo */}
        {logo ? (
          <img
            src={logo}
            alt={`${name} logo`}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              flexShrink: 0,
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: isNative ? c.brand100 : c.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isNative ? c.brand600 : c.slate500,
            fontSize: '18px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '15px', color: c.fg }}>{name}</span>

            {/* Verified badge (matching marketing badge-verified) */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '11px',
              padding: '2px 7px',
              backgroundColor: c.brand50,
              color: c.brand600,
              borderRadius: '6px',
              fontWeight: 600,
            }}>
              <svg width="10" height="10" fill={c.brand600} viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Verified
            </span>

            {/* CIP-0103 badge for native */}
            {isNative && (
              <span style={{
                fontSize: '10px',
                padding: '2px 7px',
                backgroundColor: c.cipBadgeBg,
                color: c.cipBadgeColor,
                borderRadius: '6px',
                fontWeight: 600,
                letterSpacing: '0.3px',
              }}>
                CIP-0103
              </span>
            )}
          </div>

          {/* Capabilities */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
            {capabilities.slice(0, 4).map((cap) => (
              <span key={cap} style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: c.muted,
                color: c.slate500,
                fontWeight: 500,
              }}>
                {cap}
              </span>
            ))}
            {capabilities.length > 4 && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                color: c.slate400,
              }}>
                +{capabilities.length - 4}
              </span>
            )}
          </div>

          {/* Website */}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '8px',
                fontSize: '12px',
                color: c.brand600,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {website.replace(/^https?:\/\//, '')} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const c = useTokens();
  return (
    <div>
      <div style={{ fontSize: '11px', color: c.slate400, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        color: c.fg,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
        wordBreak: 'break-all',
        lineHeight: 1.4,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Code Block (matching marketing browser chrome pattern) ─────────────────

function CodeBlock() {
  const c = useTokens();
  const shadow = c.shadow;
  return (
    <div style={{
      borderRadius: '14px',
      overflow: 'hidden',
      border: `1px solid ${c.border}`,
      boxShadow: shadow.cardHover,
      marginBottom: '40px',
    }}>
      {/* Browser chrome */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: c.muted,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981' }} />
        </div>
        <div style={{
          flex: 1,
          marginLeft: '12px',
          height: '28px',
          backgroundColor: c.bg,
          borderRadius: '6px',
          border: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '12px',
        }}>
          <span style={{ fontSize: '12px', color: c.slate400 }}>app.tsx</span>
        </div>
      </div>
      {/* Code content — always dark for readability */}
      <div style={{
        padding: '20px 24px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '13px',
        lineHeight: 1.8,
        backgroundColor: '#0F172A',
        color: '#e2e8f0',
      }}>
        <div><span style={{ color: '#c084fc' }}>import</span> {'{ PartyLayerKit, ConnectButton }'} <span style={{ color: '#c084fc' }}>from</span> <span style={{ color: '#86efac' }}>&apos;@partylayer/react&apos;</span>;</div>
        <div style={{ height: '4px' }} />
        <div><span style={{ color: '#f87171' }}>&lt;PartyLayerKit</span> <span style={{ color: '#fbbf24' }}>network</span>=<span style={{ color: '#86efac' }}>&quot;devnet&quot;</span> <span style={{ color: '#fbbf24' }}>appName</span>=<span style={{ color: '#86efac' }}>&quot;My dApp&quot;</span><span style={{ color: '#f87171' }}>&gt;</span></div>
        <div style={{ paddingLeft: '20px' }}><span style={{ color: '#f87171' }}>&lt;ConnectButton /&gt;</span> <span style={{ color: '#64748b' }}>{'// CIP-0103 wallets discovered automatically'}</span></div>
        <div><span style={{ color: '#f87171' }}>&lt;/PartyLayerKit&gt;</span></div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function KitDemoPage() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (theme !== 'auto') return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const isDark = theme === 'dark' || (theme === 'auto' && systemDark);
  const c = isDark ? darkTokens : lightTokens;

  return (
    <TokensContext.Provider value={c}>
      <div style={{
        minHeight: '100vh',
        backgroundColor: c.bg,
        color: c.fg,
        fontFamily: font,
        transition: 'background-color 200ms, color 200ms',
      }}>
        <PartyLayerKit network="devnet" appName="PartyLayer Kit Demo" theme={theme} walletIcons={WALLET_LOGOS}>
          <div style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px' }}>

            {/* Navbar */}
            <nav style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: '64px',
              borderBottom: `1px solid ${c.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img
                  src="/partylayer.xyz.svg"
                  alt="PartyLayer"
                  style={{
                    height: '96px',
                    margin: '-35px 0 -35px -9px',
                    filter: isDark ? 'invert(1)' : 'none',
                  }}
                  draggable={false}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Theme toggle */}
                <div style={{
                  display: 'flex',
                  borderRadius: '10px',
                  border: `1px solid ${c.border}`,
                  overflow: 'hidden',
                }}>
                  {(['light', 'dark', 'auto'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        backgroundColor: theme === t ? c.brand50 : 'transparent',
                        color: theme === t ? c.brand600 : c.slate500,
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: theme === t ? 600 : 400,
                        fontFamily: font,
                        transition: 'all 150ms',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <ConnectButton />
              </div>
            </nav>

            {/* Hero Section */}
            <section style={{ padding: '48px 0 40px' }}>
              {/* Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                marginBottom: '20px',
                borderRadius: '100px',
                backgroundColor: c.brand50,
                border: `1px solid ${c.brand100}`,
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: c.brand500,
                  animation: 'kit-pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: c.fg }}>Kit Demo</span>
              </div>

              <h1 style={{
                margin: '0 0 12px',
                fontSize: '2.5rem',
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: c.fg,
              }}>
                One SDK for every{' '}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ position: 'relative', zIndex: 1 }}>Canton wallet</span>
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: 0,
                    width: '100%',
                    height: '12px',
                    backgroundColor: c.brand100,
                    zIndex: 0,
                    transform: 'skewX(-3deg)',
                  }} />
                </span>
                .
              </h1>

              <p style={{
                margin: '0 0 24px',
                fontSize: '16px',
                color: c.slate500,
                lineHeight: 1.6,
                maxWidth: '520px',
              }}>
                CIP-0103 native wallet discovery with automatic registry fallback.
                Connect any Canton wallet in 3 lines of code.
              </p>

              {/* Feature badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'CIP-0103 Compliant', hasIcon: true },
                  { label: 'Auto-Discovery', hasIcon: false },
                  { label: 'Devnet', hasIcon: false },
                ].map((badge) => (
                  <span key={badge.label} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '13px',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    backgroundColor: c.muted,
                    color: c.slate700,
                    fontWeight: 500,
                    border: `1px solid ${c.border}`,
                  }}>
                    {badge.hasIcon && (
                      <svg width="12" height="12" fill={c.brand600} viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    )}
                    {badge.label}
                  </span>
                ))}
              </div>
            </section>

            {/* Code example */}
            <CodeBlock />

            {/* Main content */}
            <DemoContent />

            {/* Footer */}
            <footer style={{
              padding: '24px 0',
              marginTop: '40px',
              borderTop: `1px solid ${c.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: c.slate400 }}>
                PartyLayer SDK — Canton Network
              </span>
              <span style={{ fontSize: '13px', color: c.slate400 }}>
                CIP-0103 native wallets auto-discovered
              </span>
            </footer>
          </div>
        </PartyLayerKit>

        {/* Global keyframes */}
        <style>{`
          @keyframes kit-spin {
            to { transform: rotate(360deg); }
          }
          @keyframes kit-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </TokensContext.Provider>
  );
}
