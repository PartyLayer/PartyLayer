'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { PartyLayerKit, WalletModal, useSession, useDisconnect, truncatePartyId } from '@partylayer/react';
import { useBreakpoint, responsive } from './hooks/useBreakpoint';

/* ─── Design Tokens (mirrored from apps/marketing/src/design/tokens.ts) ── */

const t = {
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
  slate600: '#475569',
  slate700: '#334155',
  slate900: '#0F172A',
  font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  shadow: {
    card: '0 1px 3px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)',
    cardHover: '0 2px 8px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
    button: '0 1px 2px rgba(15,23,42,0.05)',
    buttonHover: '0 2px 4px rgba(15,23,42,0.08)',
    modal: '0 4px 16px rgba(15,23,42,0.08), 0 16px 48px rgba(15,23,42,0.12)',
  },
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

const GITHUB_URL = 'https://github.com/cayvox/PartyLayer';
const NPM_URL = 'https://www.npmjs.com/package/@partylayer/sdk';

/* ─── Wallet Data ──────────────────────────────────────────────────────── */

const wallets = [
  { id: 'console', name: 'Console Wallet', desc: 'Official Console Wallet for Canton Network', transport: 'Injected', logo: '/wallets/console.png' },
  { id: 'loop', name: '5N Loop', desc: '5N Loop Wallet for Canton Network', transport: 'QR Code / Popup', logo: '/wallets/loop.svg' },
  { id: 'cantor8', name: 'Cantor8 (C8)', desc: 'Cantor8 Wallet for Canton Network', transport: 'Deep Link', logo: '/wallets/cantor8.png' },
  { id: 'nightly', name: 'Nightly', desc: 'Multichain wallet with native Canton support', transport: 'Injected', logo: '/wallets/nightly.svg' },
  { id: 'bron', name: 'Bron', desc: 'Enterprise wallet for Canton Network', transport: 'OAuth2 / API', logo: '/wallets/bron.png' },
];

/* ─── Global Styles (keyframes for pulse animation) ───────────────────── */

function GlobalStyles() {
  return (
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes plPanelEnter {
        from { opacity: 0; transform: scale(0.95) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes plSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes plSuccessPop {
        0% { transform: scale(0.9); opacity: 0; }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); opacity: 1; }
      }
      .landing-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .landing-slide-up { animation: slideUp 220ms ${t.ease}; }
      .pl-panel-enter { animation: plPanelEnter 250ms ${t.ease}; }
      .pl-spin { animation: plSpin 0.8s linear infinite; }
      .pl-success-pop { animation: plSuccessPop 300ms ${t.ease}; }
      @keyframes plDropdown {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      html { scroll-behavior: smooth; }

      /* Architecture Showcase animations */
      @keyframes flowDash {
        to { stroke-dashoffset: -24; }
      }
      @keyframes nodeGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(255,204,0,0.15), 0 0 60px rgba(255,204,0,0.05); }
        50% { box-shadow: 0 0 30px rgba(255,204,0,0.25), 0 0 80px rgba(255,204,0,0.10); }
      }
      @keyframes dotTravel {
        0% { offset-distance: 0%; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { offset-distance: 100%; opacity: 0; }
      }
      @keyframes archFadeIn {
        from { opacity: 0; transform: translateY(24px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes archPathDraw {
        from { stroke-dashoffset: 200; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes archDetailSlide {
        from { opacity: 0; transform: translateY(-8px); max-height: 0; }
        to { opacity: 1; transform: translateY(0); max-height: 400px; }
      }
      .arch-glow { animation: nodeGlow 3s ease-in-out infinite; }
    `}</style>
  );
}

/* ─── Background (from apps/marketing/src/components/Background.tsx) ──── */

function Background({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Premium radial gradient glow */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 204, 0, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 0%, rgba(255, 204, 0, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 0%, rgba(255, 204, 0, 0.04) 0%, transparent 50%)
          `,
        }}
      />

      {/* Subtle noise texture */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.015,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Grid pattern */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.02,
          backgroundImage: `
            linear-gradient(to right, #0B0F1A 1px, transparent 1px),
            linear-gradient(to bottom, #0B0F1A 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10 }}>{children}</div>
    </div>
  );
}

/* ─── Logo (from apps/marketing/src/components/Logo.tsx) ──────────────── */

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: { height: 96, my: -35, ml: -9 },
    md: { height: 132, my: -48, ml: -13 },
    lg: { height: 180, my: -66, ml: -18 },
  };
  const s = sizeMap[size];
  return (
    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
      <img
        src="/partylayer.xyz.svg"
        alt="PartyLayer"
        draggable={false}
        style={{ height: s.height, marginTop: s.my, marginBottom: s.my, marginLeft: s.ml }}
      />
    </a>
  );
}

/* ─── SVG Icons ────────────────────────────────────────────────────────── */

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function NpmIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331z" />
    </svg>
  );
}

function BookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

const INSTALL_CMD = 'npm i @partylayer/sdk @partylayer/react';

function CopyInstallButton() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = INSTALL_CMD;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: t.radius.sm,
        fontSize: 14, fontWeight: 500, color: t.slate500, textDecoration: 'none',
        border: `1px solid ${t.border}`, background: t.bg, cursor: 'pointer',
        fontFamily: t.mono, transition: `all 150ms ${t.ease}`,
      }}
      onMouseOver={e => { e.currentTarget.style.background = t.muted; e.currentTarget.style.borderColor = t.slate300; }}
      onMouseOut={e => { e.currentTarget.style.background = t.bg; e.currentTarget.style.borderColor = t.border; }}
    >
      <span style={{ color: t.slate400 }}>$</span>
      <span style={{ color: t.fg }}>{INSTALL_CMD}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6,
        background: copied ? '#DCFCE7' : t.muted,
        color: copied ? '#166534' : t.slate500,
        transition: `all 150ms ${t.ease}`, flexShrink: 0,
      }}>
        {copied ? (
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </span>
    </button>
  );
}

function ExternalIcon() {
  return (
    <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity: 0.5 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <svg width={12} height={12} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  );
}

/* ─── Syntax Highlighting (from apps/marketing/src/components/CodeBlock.tsx) */

interface Token { value: string; color?: string }

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;
  const patterns: [RegExp, string | undefined][] = [
    [/^(\/\/.*)/, '#64748B'],            // comments → slate-500
    [/^("[^"]*"|'[^']*'|`[^`]*`)/, '#4ADE80'],  // strings → green-400
    [/^(import|from|export|const|let|var|function|return|if|else|for|while|class|extends|new|async|await|try|catch|throw)\b/, '#C084FC'], // keywords → purple-400
    [/^(React|useState|useEffect|useCallback|useMemo|useRef|FC|ReactNode)\b/, '#60A5FA'], // types → blue-400
    [/^(\d+\.?\d*)/, '#FBBF24'],         // numbers → amber-400
    [/^(=>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:])/, '#22D3EE'], // operators → cyan-400
    [/^(<\/?[A-Z][a-zA-Z0-9]*|<\/?[a-z][a-zA-Z0-9]*)/, '#F87171'], // JSX tags → red-400
    [/^([a-zA-Z_]\w*)\s*=/, '#FDBA74'],  // attributes → orange-300
    [/^(\S+|\s+)/, undefined],
  ];
  while (remaining.length > 0) {
    let matched = false;
    for (const [pattern, color] of patterns) {
      const match = remaining.match(pattern);
      if (match) {
        tokens.push({ value: match[1], color });
        remaining = remaining.slice(match[1].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ value: remaining[0] });
      remaining = remaining.slice(1);
    }
  }
  return tokens;
}

function HighlightedCode({ code, showLineNumbers }: { code: string; showLineNumbers?: boolean }) {
  const lines = code.split('\n');
  return (
    <pre style={{
      margin: 0, padding: 16, overflowX: 'auto', fontFamily: t.mono,
      msOverflowStyle: 'none', scrollbarWidth: 'none',
    }}>
      <code style={{ fontSize: 14, lineHeight: 1.6, color: '#CBD5E1', display: 'table', width: '100%' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'table-row' }}>
            {showLineNumbers && (
              <span style={{ display: 'table-cell', paddingRight: 16, textAlign: 'right', color: '#475569', userSelect: 'none' }}>
                {i + 1}
              </span>
            )}
            <span style={{ display: 'table-cell' }}>
              {tokenize(line).map((tok, j) => (
                <span key={j} style={tok.color ? { color: tok.color } : undefined}>{tok.value}</span>
              ))}
              {'\n'}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}

/* ─── Reusable Styled Helpers ──────────────────────────────────────────── */

function CardHover({
  children, style, ...rest
}: { children: ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      style={{
        background: t.bg, borderRadius: t.radius.lg, border: `1px solid ${t.border}`,
        boxShadow: t.shadow.card, transition: `all 150ms ${t.ease}`,
        ...style,
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = t.shadow.cardHover; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = t.shadow.card; }}
      {...rest}
    >
      {children}
    </div>
  );
}

const badge = {
  base: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500, borderRadius: 9999 } as React.CSSProperties,
  verified: { background: t.brand100, color: t.slate900 } as React.CSSProperties,
  installed: { background: '#DCFCE7', color: '#166534' } as React.CSSProperties,
  notInstalled: { background: '#F1F5F9', color: t.slate600 } as React.CSSProperties,
};

/* ─── Wallet Icon Map (for real SDK modal) ─────────────────────────────── */

const WALLET_LOGOS: Record<string, string> = {
  console: '/wallets/console.png',
  loop: '/wallets/loop.svg',
  cantor8: '/wallets/cantor8.png',
  bron: '/wallets/bron.png',
  nightly: '/wallets/nightly.svg',
};

/* ─── Nav (from apps/marketing/src/components/Nav.tsx) ─────────────────── */

const navLinks = [
  { label: 'Docs', href: '/docs/introduction' },
  { label: 'Features', href: '#features' },
  { label: 'Wallets', href: '#wallets' },
  { label: 'Quickstart', href: '#quickstart' },
  { label: 'FAQ', href: '#faq' },
];

function Nav({ onConnect }: { onConnect: () => void }) {
  const bp = useBreakpoint();
  const session = useSession();
  const { disconnect } = useDisconnect();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleDisconnect = useCallback(async () => {
    setDropdownOpen(false);
    try { await disconnect(); } catch { /* hook stores error */ }
  }, [disconnect]);

  const isConnected = !!session;
  const partyId = session ? String(session.partyId) : '';
  const walletId = session ? String(session.walletId) : '';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${t.border}`,
    }}>
      <nav style={{
        maxWidth: 1152, margin: '0 auto', padding: '0 24px',
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: t.font,
      }}>
        <Logo size="md" />

        {/* Desktop/Tablet nav links */}
        {bp !== 'mobile' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: bp === 'tablet' ? 16 : 32 }}>
            {navLinks.map(link => (
              <a key={link.href} href={link.href}
                style={{ fontSize: bp === 'tablet' ? 13 : 14, fontWeight: 500, color: t.slate600, textDecoration: 'none', transition: `color 150ms ${t.ease}` }}
                onMouseOver={e => { (e.target as HTMLElement).style.color = t.fg; }}
                onMouseOut={e => { (e.target as HTMLElement).style.color = t.slate600; }}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        {isConnected ? (
          /* ── Connected: dropdown button ── */
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(o => !o)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: t.radius.sm,
                fontSize: 13, fontWeight: 500, color: t.fg,
                border: `1px solid ${t.border}`, cursor: 'pointer',
                background: t.muted, boxShadow: t.shadow.button,
                fontFamily: t.font, transition: `all 150ms ${t.ease}`,
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.18)'; e.currentTarget.style.boxShadow = t.shadow.buttonHover; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = t.shadow.button; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: `0 0 0 2px ${t.muted}` }} />
              <span style={{ fontFamily: t.mono, fontSize: 13, color: t.fg }}>{truncatePartyId(partyId)}</span>
              <svg width={12} height={12} fill="none" viewBox="0 0 24 24" stroke={t.slate400} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: t.bg, border: `1px solid ${t.border}`, borderRadius: t.radius.sm,
                boxShadow: '0 4px 16px rgba(15,23,42,0.08), 0 16px 48px rgba(15,23,42,0.12)',
                minWidth: 240, zIndex: 1000, overflow: 'hidden',
                animation: `plDropdown 150ms ${t.ease}`,
              }}>
                {/* Session info */}
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Connected</span>
                  </div>
                  <div style={{ fontFamily: t.mono, fontSize: 12, color: t.fg, wordBreak: 'break-all', lineHeight: 1.4 }}>
                    {truncatePartyId(partyId, 10)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: t.slate500 }}>{walletId}</div>
                </div>

                {/* Disconnect */}
                <button onClick={handleDisconnect}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '12px 16px', border: 'none',
                    background: 'transparent', color: '#EF4444', cursor: 'pointer',
                    textAlign: 'left', fontSize: 13, fontWeight: 500, fontFamily: t.font,
                    transition: `background 150ms ${t.ease}`,
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Disconnected: connect button ── */
          <button onClick={onConnect}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: responsive(bp, '8px 16px', '8px 20px', '10px 28px'), borderRadius: t.radius.sm,
              fontSize: bp === 'mobile' ? 13 : 15, fontWeight: 600, color: t.fg, border: 'none', cursor: 'pointer',
              background: t.brand500, boxShadow: t.shadow.button,
              fontFamily: t.font, transition: `all 150ms ${t.ease}`,
            }}
            onMouseOver={e => { e.currentTarget.style.background = t.brand600; e.currentTarget.style.boxShadow = t.shadow.buttonHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.currentTarget.style.background = t.brand500; e.currentTarget.style.boxShadow = t.shadow.button; e.currentTarget.style.transform = 'none'; }}
          >
            <svg width={bp === 'mobile' ? 16 : 18} height={bp === 'mobile' ? 16 : 18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
            {bp !== 'mobile' && 'Connect Wallet'}
            {bp === 'mobile' && 'Connect'}
          </button>
        )}

        {/* Mobile hamburger */}
        {bp === 'mobile' && (
          <button onClick={() => setMobileMenuOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: t.radius.sm,
            border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer',
            order: -1, marginRight: 'auto', marginLeft: 12,
          }}>
            <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke={t.slate600} strokeWidth={2} strokeLinecap="round">
              {mobileMenuOpen
                ? <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>
                : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>
              }
            </svg>
          </button>
        )}
      </nav>

      {/* Mobile menu dropdown */}
      {bp === 'mobile' && mobileMenuOpen && (
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0, zIndex: 39,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${t.border}`, boxShadow: t.shadow.modal,
          padding: '8px 24px 16px', fontFamily: t.font,
        }}>
          {navLinks.map(link => (
            <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'block', padding: '14px 0', fontSize: 15, fontWeight: 500,
                color: t.slate600, textDecoration: 'none',
                borderBottom: `1px solid ${t.border}`,
              }}>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

/* ─── Hero (from apps/marketing/src/components/sections/Hero.tsx) ──────── */

function Hero({ onConnect }: { onConnect: () => void }) {
  const bp = useBreakpoint();
  return (
    <section style={{ position: 'relative', padding: responsive(bp, '48px 0 56px', '64px 0 72px', '80px 0 96px'), fontFamily: t.font }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        <div style={{
          display: bp === 'mobile' ? 'flex' : 'grid',
          flexDirection: bp === 'mobile' ? 'column' : undefined,
          gridTemplateColumns: bp !== 'mobile' ? '1fr 1fr' : undefined,
          gap: responsive(bp, 32, 32, 64),
          alignItems: 'center',
        }}>
          {/* Text Content */}
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', marginBottom: 24, borderRadius: 9999,
              background: t.brand50, border: `1px solid ${t.brand100}`,
            }}>
              <span className="landing-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: t.brand500, display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>Now Open Source</span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: responsive(bp, '1.75rem', '2.5rem', '3.25rem'), lineHeight: 1.1, letterSpacing: '-0.02em',
              fontWeight: 700, color: t.fg, marginBottom: 24,
              textWrap: 'balance',
            }}>
              One SDK for every{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'relative', zIndex: 1 }}>Canton wallet</span>
                <span style={{
                  position: 'absolute', bottom: 4, left: 0, width: '100%', height: 12,
                  background: t.brand100, zIndex: 0, transform: 'skewX(-3deg)',
                }} />
              </span>
              .
            </h1>

            {/* Subtitle */}
            <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate600, maxWidth: 480, marginBottom: 32 }}>
              CIP-0103 compliant wallet integration for Canton — registry-backed, verified wallets,
              and a clean developer experience.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: bp === 'mobile' ? 'column' : 'row', gap: 12, alignItems: bp === 'mobile' ? 'stretch' : 'center' }}>
              <Link href="/docs/introduction"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: t.radius.sm,
                  fontSize: 15, fontWeight: 600, color: t.fg, textDecoration: 'none',
                  background: t.brand500, boxShadow: t.shadow.button,
                  transition: `all 150ms ${t.ease}`,
                }}
                onMouseOver={e => { e.currentTarget.style.background = t.brand600; e.currentTarget.style.boxShadow = t.shadow.buttonHover; }}
                onMouseOut={e => { e.currentTarget.style.background = t.brand500; e.currentTarget.style.boxShadow = t.shadow.button; }}
              >
                <BookIcon size={20} /> View Documentation
              </Link>
              <CopyInstallButton />
            </div>

          </div>

          {/* Device Preview */}
          <div style={{ position: 'relative', display: bp === 'mobile' ? 'none' : 'block' }}>
            <div style={{ position: 'relative', maxWidth: 448, marginLeft: 'auto' }}>
              {/* Device Frame */}
              <div style={{
                position: 'relative', background: t.bg, borderRadius: t.radius.xl,
                border: `1px solid ${t.border}`, boxShadow: t.shadow.cardHover,
                overflow: 'hidden', transform: 'rotate(1deg)',
                transition: `transform 300ms ${t.ease}`,
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'rotate(0deg)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'rotate(1deg)'; }}
              >
                {/* Browser Chrome */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                  background: t.muted, borderBottom: `1px solid ${t.border}`,
                }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#F87171' }} />
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FBBF24' }} />
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#34D399' }} />
                  </div>
                  <div style={{ flex: 1, margin: '0 16px' }}>
                    <div style={{
                      height: 24, background: t.bg, borderRadius: 6,
                      border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', padding: '0 12px',
                    }}>
                      <span style={{ fontSize: 12, color: t.slate400 }}>yourapp.canton</span>
                    </div>
                  </div>
                </div>

                {/* Modal Preview */}
                <div style={{ padding: 24, background: 'rgba(245,246,248,0.3)' }}>
                  <div style={{
                    background: t.bg, borderRadius: t.radius.lg,
                    border: `1px solid ${t.border}`, boxShadow: t.shadow.modal,
                    padding: 20, maxWidth: 360, margin: '0 auto',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: t.fg, margin: 0 }}>Connect Wallet</h3>
                      <div style={{
                        width: 24, height: 24, borderRadius: t.radius.sm,
                        background: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width={16} height={16} fill="none" stroke={t.slate400} strokeWidth={2}><path d="M6 6l8 8M14 6l-8 8" /></svg>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.5, color: t.slate500, marginBottom: 16, marginTop: 0 }}>
                      Select a wallet to connect to this dapp.
                    </p>

                    {/* Wallet List Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {wallets.map((wallet, i) => (
                        <button key={wallet.id} onClick={onConnect}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                            borderRadius: t.radius.md, border: `1px solid ${t.border}`,
                            background: i === 0 ? t.brand50 : t.bg,
                            cursor: 'pointer', textAlign: 'left', fontFamily: t.font, width: '100%',
                            transition: `all 150ms ${t.ease}`,
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = t.muted; e.currentTarget.style.borderColor = t.slate300; }}
                          onMouseOut={e => { e.currentTarget.style.background = i === 0 ? t.brand50 : t.bg; e.currentTarget.style.borderColor = t.border; }}
                        >
                          <img src={wallet.logo} alt={`${wallet.name} logo`} width={40} height={40} style={{ borderRadius: t.radius.sm }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 500, color: t.fg }}>{wallet.name}</span>
                              <span style={{ ...badge.base, ...badge.verified }}>
                                <VerifiedBadge /> Verified
                              </span>
                            </div>
                          </div>
                          {i === 0 && (
                            <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>Installed</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating blur elements */}
              <div style={{
                position: 'absolute', top: -16, right: -16, width: 96, height: 96,
                background: t.brand100, borderRadius: '50%', filter: 'blur(48px)', opacity: 0.6, pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: -16, left: -16, width: 128, height: 128,
                background: t.brand50, borderRadius: '50%', filter: 'blur(48px)', opacity: 0.8, pointerEvents: 'none',
              }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Architecture Showcase ────────────────────────────────────────────── */

type ArchNodeId = 'dapp' | 'hooks' | 'sdk' | 'adapters' | 'wallets';

const archNodes: { id: ArchNodeId; label: string; sub: string; icon: ReactNode; detail: ReactNode }[] = [
  {
    id: 'dapp', label: 'Your dApp', sub: '3 lines to integrate',
    icon: (
      <svg width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="#818CF8" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    detail: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 8 }}>Quick Integration</div>
        <pre style={{
          margin: 0, padding: 12, borderRadius: 8, background: '#0F172A', fontSize: 12,
          fontFamily: t.mono, lineHeight: 1.6, overflowX: 'auto', color: '#CBD5E1',
        }}>
          <span style={{ color: '#C084FC' }}>import</span>{' { PartyLayerKit }'} <span style={{ color: '#C084FC' }}>from</span> <span style={{ color: '#4ADE80' }}>{`'@partylayer/react'`}</span>{'\n'}
          {'\n'}
          <span style={{ color: '#64748B' }}>{'// Wrap your app — done.'}</span>{'\n'}
          {'<'}<span style={{ color: '#F87171' }}>PartyLayerKit</span> <span style={{ color: '#FDBA74' }}>network</span>{'='}<span style={{ color: '#4ADE80' }}>{`"mainnet"`}</span>{'>'}{'\n'}
          {'  <'}<span style={{ color: '#F87171' }}>App</span>{' />'}{'\n'}
          {'</'}<span style={{ color: '#F87171' }}>PartyLayerKit</span>{'>'}
        </pre>
      </div>
    ),
  },
  {
    id: 'hooks', label: 'React Hooks', sub: 'useConnect, useSession',
    icon: (
      <svg width={28} height={28} viewBox="0 0 24 24" fill="#60A5FA">
        <path d="M12 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        <path d="M12 6c3.17 0 6.07.72 8.18 2.04.37.23.7.48 1 .76C22.3 9.86 23 11 23 12s-.7 2.14-1.82 3.2c-.3.28-.63.53-1 .76C18.07 17.28 15.17 18 12 18s-6.07-.72-8.18-2.04c-.37-.23-.7-.48-1-.76C1.7 14.14 1 13 1 12s.7-2.14 1.82-3.2c.3-.28.63-.53 1-.76C5.93 6.72 8.83 6 12 6zm0 1.5c-2.89 0-5.5.62-7.32 1.76-.26.16-.5.34-.72.52C3.04 10.6 2.5 11.33 2.5 12s.54 1.4 1.46 2.22c.22.18.46.36.72.52C6.5 15.88 9.11 16.5 12 16.5s5.5-.62 7.32-1.76c.26-.16.5-.34.72-.52.92-.82 1.46-1.55 1.46-2.22s-.54-1.4-1.46-2.22a7.3 7.3 0 00-.72-.52C17.5 8.12 14.89 7.5 12 7.5z" />
        <path d="M8.03 17.7c1.59 2.74 3.54 4.3 5.47 4.3.97 0 1.89-.4 2.7-1.12.54-.48 1.03-1.1 1.48-1.84.79-1.32 1.38-2.96 1.72-4.78.12-.65.2-1.32.25-2.01.07-.96.05-1.93-.06-2.87-.08-.72-.2-1.41-.37-2.06a12.3 12.3 0 00-.73-2.06c-.36-.78-.79-1.46-1.28-2.01-.74-.83-1.59-1.37-2.53-1.5-.12-.02-.24-.02-.36-.02-1.93 0-3.88 1.56-5.47 4.3-.92 1.58-1.65 3.47-2.08 5.5-.43 2.03-.53 3.97-.33 5.67.07.58.18 1.13.32 1.64.17.6.4 1.15.68 1.63.17.3.37.58.58.84zm1.3-.75c-.16-.23-.3-.48-.42-.75-.23-.52-.4-1.1-.51-1.73-.18-1.48-.1-3.23.27-5.03.39-1.84 1.06-3.57 1.89-5C12.04 1.94 13.6.5 14.5.5l.2.01c.55.08 1.07.37 1.54.85.39.44.73.98 1.03 1.63.24.51.45 1.07.62 1.68.14.52.25 1.08.32 1.67.1.81.12 1.66.06 2.51-.04.59-.12 1.19-.22 1.77-.31 1.63-.84 3.12-1.52 4.27-.37.62-.77 1.14-1.2 1.53-.6.53-1.24.78-1.83.78-1.3 0-2.86-1.44-4.36-4.51l-.32-.71z" />
        <path d="M15.97 17.7c-1.59 2.74-3.54 4.3-5.47 4.3-.97 0-1.89-.4-2.7-1.12-.54-.48-1.03-1.1-1.48-1.84-.79-1.32-1.38-2.96-1.72-4.78a20.1 20.1 0 01-.25-2.01c-.07-.96-.05-1.93.06-2.87.08-.72.2-1.41.37-2.06.24-.82.57-1.52.73-2.06.36-.78.79-1.46 1.28-2.01.74-.83 1.59-1.37 2.53-1.5.12-.02.24-.02.36-.02 1.93 0 3.88 1.56 5.47 4.3.92 1.58 1.65 3.47 2.08 5.5.43 2.03.53 3.97.33 5.67-.07.58-.18 1.13-.32 1.64-.17.6-.4 1.15-.68 1.63-.17.3-.37.58-.58.84zm-1.3-.75c.16-.23.3-.48.42-.75.23-.52.4-1.1.51-1.73.18-1.48.1-3.23-.27-5.03-.39-1.84-1.06-3.57-1.89-5C11.96 1.94 10.4.5 9.5.5l-.2.01c-.55.08-1.07.37-1.54.85-.39.44-.73.98-1.03 1.63-.24.51-.45 1.07-.62 1.68-.14.52-.25 1.08-.32 1.67-.1.81-.12 1.66-.06 2.51.04.59.12 1.19.22 1.77.31 1.63.84 3.12 1.52 4.27.37.62.77 1.14 1.2 1.53.6.53 1.24.78 1.83.78 1.3 0 2.86-1.44 4.36-4.51l.32-.71z" />
      </svg>
    ),
    detail: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 8 }}>Available Hooks</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {['useConnect', 'useSession', 'useDisconnect', 'useWallets', 'useSign', 'useProvider'].map(h => (
            <div key={h} style={{
              padding: '6px 10px', borderRadius: 6, background: '#EEF2FF',
              fontFamily: t.mono, fontSize: 12, color: '#4338CA', fontWeight: 500,
            }}>{h}()</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'sdk', label: 'PartyLayer SDK', sub: 'CIP-0103 Compliant',
    icon: <img src="/favicon-new.svg" alt="PartyLayer" width={28} height={28} />,
    detail: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 8 }}>Core Capabilities</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { m: 'connect / disconnect', d: 'Session lifecycle management' },
            { m: 'signMessage', d: 'Arbitrary message signing' },
            { m: 'prepareExecute', d: 'Transaction preparation & execution' },
            { m: 'CIP-0103 Bridge', d: 'Native provider passthrough' },
          ].map(({ m, d }) => (
            <div key={m}>
              <code style={{ fontFamily: t.mono, fontSize: 12, color: t.brand600, fontWeight: 600 }}>{m}</code>
              <div style={{ fontSize: 11, color: t.slate500, marginTop: 1 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'adapters', label: 'Adapter Layer', sub: 'Auto-detected',
    icon: (
      <svg width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="#10B981" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.126 1.2-.143l.72-.533a1.125 1.125 0 011.37.104l.774.773c.394.394.48.972.104 1.37l-.533.72c-.27.356-.32.804-.143 1.2.177.396.506.71.93.78l.894.149c.542.09.94.56.94 1.11v1.093c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.764.384-.93.78s-.126.844.143 1.2l.533.72a1.125 1.125 0 01-.104 1.37l-.774.773c-.394.394-.972.48-1.37.104l-.72-.533c-.356-.27-.804-.32-1.2-.143-.396.177-.71.506-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.13 1.13 0 00-.78-.93c-.396-.177-.844-.126-1.2.143l-.72.533a1.125 1.125 0 01-1.37-.104l-.774-.773a1.125 1.125 0 01-.104-1.37l.533-.72c.27-.356.32-.804.143-1.2a1.13 1.13 0 00-.93-.78l-.894-.149c-.542-.09-.94-.56-.94-1.11v-1.093c0-.55.398-1.02.94-1.11l.894-.149a1.13 1.13 0 00.93-.78c.177-.396.126-.844-.143-1.2l-.533-.72a1.125 1.125 0 01.104-1.37l.774-.773a1.125 1.125 0 011.37-.104l.72.533c.356.27.804.32 1.2.143.396-.177.71-.506.78-.93l.149-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    detail: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 8 }}>Transport Types</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { label: 'Injected', color: '#818CF8' },
            { label: 'QR Code', color: '#F472B6' },
            { label: 'Deep Link', color: '#34D399' },
            { label: 'OAuth2', color: '#FB923C' },
            { label: 'CIP-0103 Native', color: t.brand600 },
          ].map(({ label, color }) => (
            <span key={label} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: `${color}14`, color, border: `1px solid ${color}30`,
            }}>{label}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'wallets', label: 'Wallets', sub: '5 wallets, 1 integration',
    icon: (
      <svg width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    ),
    detail: (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 8 }}>Supported Wallets</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {wallets.map(w => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={w.logo} alt={w.name} width={24} height={24} style={{ borderRadius: 6 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: t.fg }}>{w.name}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function ArchitectureShowcase() {
  const bp = useBreakpoint();
  const [activeNode, setActiveNode] = useState<ArchNodeId | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ArchNodeId | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleNode = (id: ArchNodeId) => setActiveNode(prev => prev === id ? null : id);
  const highlighted = hoveredNode || activeNode;

  return (
    <section ref={sectionRef} style={{ padding: responsive(bp, '56px 0 48px', '64px 0 56px', '80px 0 64px'), fontFamily: t.font }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{
          textAlign: 'center', marginBottom: responsive(bp, 32, 40, 56),
          opacity: isVisible ? 1 : 0, transform: isVisible ? 'none' : 'translateY(24px)',
          transition: `all 800ms ${t.ease}`,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 14px', borderRadius: 9999, marginBottom: 16,
            background: t.brand50, border: `1px solid ${t.brand100}`,
            fontSize: 13, fontWeight: 600, color: t.brand600, letterSpacing: '0.02em',
          }}>
            Architecture
          </div>
          <h2 style={{
            fontSize: responsive(bp, '1.75rem', '2rem', '2.5rem'), fontWeight: 700, color: t.fg,
            lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 12,
          }}>
            How PartyLayer Works
          </h2>
          <p style={{ fontSize: bp === 'mobile' ? 15 : 17, color: t.slate500, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            From your first line of code to a connected wallet — the entire flow, abstracted.
          </p>
        </div>

        {/* Flow Diagram */}
        <div style={{ position: 'relative' }}>
          {/* Horizontal connector line (desktop only) */}
          {bp === 'desktop' && (
            <div style={{
              position: 'absolute', top: 52, left: '10%', right: '10%',
              height: 1, background: t.slate300,
              opacity: isVisible ? 1 : 0,
              transition: `opacity 800ms ${t.ease} 300ms`,
              zIndex: 0, overflow: 'hidden',
            }}>
              {isVisible && [0, 1, 2, 3].map(j => (
                <div key={j} style={{
                  position: 'absolute', top: -3, width: 7, height: 7,
                  borderRadius: '50%', background: t.brand500,
                  boxShadow: `0 0 8px ${t.brand500}`,
                  animation: `dotFlow 3.5s ${j * 0.8}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          )}

          {/* Node Grid / Flex */}
          <div style={{
            display: bp === 'mobile' ? 'flex' : 'grid',
            flexDirection: bp === 'mobile' ? 'column' : undefined,
            alignItems: bp === 'mobile' ? 'center' : 'start',
            gridTemplateColumns: bp === 'desktop' ? 'repeat(5, 1fr)' : bp === 'tablet' ? 'repeat(3, 1fr)' : undefined,
            justifyItems: 'center',
            gap: bp === 'tablet' ? 16 : 0,
            position: 'relative', zIndex: 1,
          }}>
            {archNodes.map((node, i) => {
              const isActive = activeNode === node.id;
              const isHovered = hoveredNode === node.id;
              const isHighlighted = highlighted === node.id || !highlighted;
              const isSdk = node.id === 'sdk';
              const delay = i * 120;

              return (
                <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: isActive ? 10 : 1, minWidth: 0 }}>
                  {/* Vertical connector (mobile only) */}
                  {i > 0 && bp === 'mobile' && isVisible && (
                    <div style={{
                      width: 1, height: 28, background: t.slate300, margin: '0 auto 0',
                      opacity: isVisible ? 1 : 0,
                    }} />
                  )}

                  {/* Node Card */}
                  <button
                    onClick={() => toggleNode(node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      marginTop: bp === 'desktop' ? (isSdk ? 0 : 8) : 0,
                      padding: isSdk ? '24px 20px' : '20px 16px',
                      borderRadius: isSdk ? t.radius.xl : t.radius.lg,
                      border: `1px solid ${isActive || isHovered ? (isSdk ? t.brand500 : t.slate300) : t.border}`,
                      background: isActive ? (isSdk ? t.brand50 : t.muted) : t.bg,
                      cursor: 'pointer', fontFamily: t.font, width: '100%',
                      maxWidth: bp === 'mobile' ? 280 : (isSdk ? 200 : 170),
                      boxShadow: isActive || isHovered
                        ? (isSdk ? `0 0 24px rgba(255,204,0,0.15), ${t.shadow.cardHover}` : t.shadow.cardHover)
                        : t.shadow.card,
                      transform: isVisible
                        ? (isHovered ? 'translateY(-4px)' : 'none')
                        : 'translateY(24px) scale(0.95)',
                      opacity: isVisible ? (isHighlighted ? 1 : 0.5) : 0,
                      transition: `all 500ms ${t.ease} ${delay}ms`,
                      position: 'relative', overflow: 'visible',
                    }}
                  >
                    {/* CIP badge for SDK */}
                    {isSdk && (
                      <div style={{
                        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        padding: '2px 10px', borderRadius: 9999,
                        background: t.brand500, fontSize: 10, fontWeight: 700,
                        color: t.fg, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      }}>
                        CIP-0103
                      </div>
                    )}

                    {/* Icon */}
                    <div style={{
                      width: isSdk ? 56 : 48, height: isSdk ? 56 : 48,
                      borderRadius: isSdk ? 16 : 12,
                      background: isSdk ? t.brand50 : t.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${isSdk ? t.brand100 : t.border}`,
                    }}>
                      {node.icon}
                    </div>

                    {/* Label */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: isSdk ? 16 : 14, fontWeight: 600, color: t.fg, lineHeight: 1.3 }}>
                        {node.label}
                      </div>
                      <div style={{ fontSize: 12, color: t.slate500, marginTop: 2 }}>
                        {node.sub}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: isActive ? t.brand500 : t.muted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: `all 200ms ${t.ease}`,
                      transform: isActive ? 'rotate(180deg)' : 'none',
                    }}>
                      <svg width={10} height={10} fill="none" viewBox="0 0 24 24"
                        stroke={isActive ? t.fg : t.slate400} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Detail Panel — smooth expand/collapse */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: isActive ? 400 : 0,
                    opacity: isActive ? 1 : 0,
                    marginTop: isActive ? 12 : 0,
                    transition: `max-height 350ms ${t.ease}, opacity 250ms ${t.ease}, margin-top 350ms ${t.ease}`,
                    width: '100%',
                    maxWidth: bp === 'mobile' ? 320 : undefined,
                  }}>
                    <div style={{
                      padding: 16, borderRadius: t.radius.md,
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(12px)',
                      border: `1px solid ${t.border}`,
                      boxShadow: t.shadow.modal,
                    }}>
                      {node.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom flow label */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            marginTop: bp === 'mobile' ? 24 : 40, opacity: isVisible ? 1 : 0,
            transition: `opacity 800ms ${t.ease} 800ms`,
          }}>
            <div style={{ width: 40, height: 1, background: t.slate300 }} />
            <span style={{ fontSize: 13, color: t.slate400, fontWeight: 500 }}>
              Click any node to explore
            </span>
            <div style={{ width: 40, height: 1, background: t.slate300 }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── ProofBar (from apps/marketing/src/components/sections/ProofBar.tsx) ─ */

const proofItems = [
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: 'Open Source',
    description: 'MIT licensed. View, fork, and contribute on GitHub.',
  },
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Registry-Backed',
    description: 'Cryptographically verified wallet registry prevents spoofing.',
  },
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    ),
    title: 'Multi-Wallet',
    description: 'Console, Loop, Cantor8, Nightly, Bron — one integration for all.',
  },
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: 'CIP-0103 Standard',
    description: 'Full CIP-0103 compliance with 10 methods, 4 events, and typed error model.',
  },
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'TypeScript-First',
    description: 'Branded types, strict mode, and full IntelliSense for every API surface.',
  },
  {
    icon: (
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125V18a3.75 3.75 0 01-3.75 3.75zM19.5 7.125v5.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-5.25c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125z" />
      </svg>
    ),
    title: 'Theme System',
    description: 'Light, dark, and auto themes with fully customizable design tokens.',
  },
];

function ProofBar() {
  const bp = useBreakpoint();
  return (
    <section id="features" style={{ padding: responsive(bp, '48px 0', '56px 0', '64px 0'), borderTop: `1px solid ${t.border}`, fontFamily: t.font }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        {/* Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: responsive(bp, '1fr', 'repeat(2, 1fr)', 'repeat(3, 1fr)'), gap: bp === 'mobile' ? 16 : 24 }}>
          {proofItems.map((item, i) => (
            <CardHover key={i} style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  flexShrink: 0, width: 48, height: 48, borderRadius: t.radius.md,
                  background: t.brand50, color: t.brand600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: t.fg, margin: '0 0 4px' }}>{item.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: t.slate500, margin: 0 }}>{item.description}</p>
                </div>
              </div>
            </CardHover>
          ))}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 40 }}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: t.radius.md,
              background: t.muted, color: t.fg, textDecoration: 'none', fontSize: 14, fontWeight: 500,
              transition: `background 150ms ${t.ease}`,
            }}
            onMouseOver={e => { e.currentTarget.style.background = t.muted2; }}
            onMouseOut={e => { e.currentTarget.style.background = t.muted; }}
          >
            <GitHubIcon size={20} />
            <span>Star on GitHub</span>
          </a>
          <a href={NPM_URL} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: t.radius.md,
              background: t.muted, color: t.fg, textDecoration: 'none', fontSize: 14, fontWeight: 500,
              transition: `background 150ms ${t.ease}`,
            }}
            onMouseOver={e => { e.currentTarget.style.background = t.muted2; }}
            onMouseOut={e => { e.currentTarget.style.background = t.muted; }}
          >
            <NpmIcon size={20} />
            <span>@partylayer/sdk</span>
          </a>
        </div>
      </div>
    </section>
  );
}


/* ─── How It Works (from apps/marketing/src/components/sections/HowItWorks.tsx) */


/* ─── Wallet Grid (from apps/marketing/src/components/sections/WalletGrid.tsx) */

function WalletGrid() {
  const bp = useBreakpoint();
  return (
    <section id="wallets" style={{ padding: responsive(bp, '56px 0', '64px 0', '80px 0'), borderTop: `1px solid ${t.border}`, fontFamily: t.font }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: responsive(bp, 32, 40, 56) }}>
          <h2 style={{ fontSize: responsive(bp, '1.5rem', '1.75rem', '2rem'), lineHeight: 1.2, letterSpacing: '-0.015em', fontWeight: 700, color: t.fg, marginBottom: 12 }}>
            Supported wallets
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate500, maxWidth: 520, margin: '0 auto' }}>
            All verified wallets in the Canton ecosystem, unified behind a single interface.
          </p>
        </div>

        {/* Wallet Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: responsive(bp, '1fr', 'repeat(2, 1fr)', 'repeat(5, 1fr)'), gap: bp === 'mobile' ? 16 : 24 }}>
          {wallets.map(wallet => (
            <CardHover key={wallet.id} style={{ padding: 20, cursor: 'pointer' }}>
              {/* Logo */}
              <div style={{ width: 56, height: 56, borderRadius: t.radius.lg, marginBottom: 16, overflow: 'hidden' }}>
                <img src={wallet.logo} alt={`${wallet.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Name & Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: t.fg, margin: 0 }}>{wallet.name}</h3>
                <span style={{ ...badge.base, ...badge.verified }}>
                  <VerifiedBadge /> Verified
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: 14, lineHeight: 1.5, color: t.slate500, marginBottom: 12, marginTop: 0 }}>
                {wallet.desc}
              </p>

              {/* Transport */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: t.slate400 }}>{wallet.transport}</span>
              </div>
            </CardHover>
          ))}
        </div>

        {/* Registry Note */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: t.slate500 }}>
            Wallet providers can apply for registry inclusion.{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: t.brand600, textDecoration: 'underline', textUnderlineOffset: 2 }}
              onMouseOver={e => { (e.target as HTMLElement).style.color = t.brand500; }}
              onMouseOut={e => { (e.target as HTMLElement).style.color = t.brand600; }}
            >
              Learn more →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Developer Quickstart (from apps/marketing/src/components/sections/DeveloperQuickstart.tsx) */

const codeTabs = [
  {
    id: 'install',
    label: 'Install',
    code: `npm install @partylayer/sdk @partylayer/react

# or with yarn
yarn add @partylayer/sdk @partylayer/react

# or with pnpm
pnpm add @partylayer/sdk @partylayer/react`,
  },
  {
    id: 'react',
    label: 'React Setup',
    code: `import { PartyLayerKit, ConnectButton } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp" theme="auto">
      <ConnectButton />
      <YourApp />
    </PartyLayerKit>
  );
}`,
  },
  {
    id: 'vanilla',
    label: 'Vanilla JS',
    code: `import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});

const session = await client.connect({ walletId: 'console' });
const signed = await client.signMessage({ message: 'Hello!' });`,
  },
  {
    id: 'cip0103',
    label: 'CIP-0103',
    code: `import { discoverInjectedProviders } from '@partylayer/provider';

// Discover all CIP-0103 wallets on window.canton.*
const providers = discoverInjectedProviders();

// Use standard CIP-0103 methods
const provider = providers[0].provider;
await provider.request({ method: 'connect' });
const accounts = await provider.request({ method: 'listAccounts' });`,
  },
];

function DeveloperQuickstart() {
  const bp = useBreakpoint();
  const [activeTab, setActiveTab] = useState('install');
  const [copied, setCopied] = useState(false);
  const tab = codeTabs.find(c => c.id === activeTab)!;

  const handleCopy = () => {
    void navigator.clipboard.writeText(tab.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section id="quickstart" style={{ padding: responsive(bp, '56px 0', '64px 0', '80px 0'), background: 'rgba(245,246,248,0.3)', borderTop: `1px solid ${t.border}`, fontFamily: t.font }}>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: bp === 'mobile' ? 24 : 40 }}>
          <h2 style={{ fontSize: responsive(bp, '1.5rem', '1.75rem', '2rem'), lineHeight: 1.2, letterSpacing: '-0.015em', fontWeight: 700, color: t.fg, marginBottom: 12 }}>
            Developer quickstart
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate500, maxWidth: 480, margin: '0 auto' }}>
            Add wallet connectivity to your Canton dapp in minutes.
          </p>
        </div>

        {/* Code Block */}
        <div style={{
          background: t.bg, borderRadius: t.radius.lg, border: `1px solid ${t.border}`,
          boxShadow: t.shadow.card, overflow: 'hidden',
        }}>
          {/* Tab Headers */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}` }}>
            {codeTabs.map(ct => (
              <button key={ct.id} onClick={() => { setActiveTab(ct.id); setCopied(false); }}
                style={{
                  flex: 1, padding: responsive(bp, '10px 8px', '12px 14px', '12px 16px'), fontSize: responsive(bp, 12, 13, 14), fontWeight: 500,
                  background: activeTab === ct.id ? t.muted : 'transparent',
                  color: activeTab === ct.id ? t.fg : t.slate500,
                  borderBottom: activeTab === ct.id ? `2px solid ${t.brand500}` : '2px solid transparent',
                  border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  cursor: 'pointer', fontFamily: t.font,
                  transition: `color 150ms ${t.ease}`,
                  marginBottom: activeTab === ct.id ? -1 : 0,
                }}>
                {ct.label}
              </button>
            ))}
          </div>

          {/* Code Content */}
          <div style={{ position: 'relative' }}>
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              style={{
                position: 'absolute', right: 8, top: 8, zIndex: 2,
                padding: 6, borderRadius: t.radius.sm, border: 'none', cursor: 'pointer',
                background: 'transparent', color: copied ? '#4ADE80' : t.slate400,
                transition: `all 150ms ${t.ease}`,
              }}
              onMouseOver={e => { if (!copied) { e.currentTarget.style.color = '#E2E8F0'; e.currentTarget.style.background = t.slate700; } }}
              onMouseOut={e => { if (!copied) { e.currentTarget.style.color = t.slate400; e.currentTarget.style.background = 'transparent'; } }}
              aria-label={copied ? 'Copied!' : 'Copy code'}
            >
              {copied ? (
                <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            <div style={{ background: t.slate900, borderRadius: 0, overflow: 'hidden', borderTop: `1px solid #1E293B` }}>
              <HighlightedCode code={tab.code} showLineNumbers />
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: bp === 'mobile' ? 12 : 16, marginTop: bp === 'mobile' ? 24 : 32, flexDirection: bp === 'mobile' ? 'column' : 'row' }}>
          <Link href="/docs/introduction"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: responsive(bp, '10px 16px', '10px 20px', '10px 20px'), borderRadius: t.radius.sm,
              background: t.brand500, color: t.fg, fontWeight: 600, fontSize: 14, textDecoration: 'none',
              transition: `background 150ms ${t.ease}`,
            }}
            onMouseOver={e => { e.currentTarget.style.background = t.brand600; }}
            onMouseOut={e => { e.currentTarget.style.background = t.brand500; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Full Documentation
          </Link>
          <Link href="/kit-demo"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: responsive(bp, '10px 16px', '10px 20px', '10px 20px'), borderRadius: t.radius.sm,
              border: `1px solid ${t.border}`, color: t.fg, fontWeight: 600, fontSize: 14, textDecoration: 'none',
              transition: `all 150ms ${t.ease}`,
            }}>
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Interactive Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Demo CTA (replaces interactive Demo — links to /kit-demo) ────────── */

function DemoCTA({ onConnect }: { onConnect: () => void }) {
  const bp = useBreakpoint();
  return (
    <section id="demo" style={{ padding: responsive(bp, '56px 0', '64px 0', '80px 0'), borderTop: `1px solid ${t.border}`, fontFamily: t.font }}>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: bp === 'mobile' ? 24 : 40 }}>
          <h2 style={{ fontSize: responsive(bp, '1.5rem', '1.75rem', '2rem'), lineHeight: 1.2, letterSpacing: '-0.015em', fontWeight: 700, color: t.fg, marginBottom: 12 }}>
            Interactive demo
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate500, maxWidth: 480, margin: '0 auto' }}>
            Try the wallet connection flow right here — click Connect Wallet to see the modal in action.
          </p>
        </div>

        {/* Demo Card */}
        <div style={{
          background: t.bg, borderRadius: t.radius.lg, border: `1px solid ${t.border}`,
          boxShadow: t.shadow.card, overflow: 'hidden',
        }}>
          <div style={{ padding: responsive(bp, 16, 24, 32) }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: responsive(bp, 20, 28, 32), borderRadius: t.radius.lg, background: 'rgba(245,246,248,0.5)', border: `1px solid ${t.border}`,
            }}>
              {/* Icon */}
              <div style={{
                width: 64, height: 64, margin: '0 auto 16px', borderRadius: t.radius.xl,
                background: t.brand100, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={32} height={32} fill="none" viewBox="0 0 24 24" stroke={t.brand600} strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>

              <h4 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.4, color: t.fg, margin: '0 0 8px' }}>Your dApp</h4>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: t.slate500, margin: '0 0 24px', textAlign: 'center' }}>
                Click the button to open the wallet connection modal.
              </p>

              <button onClick={onConnect}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '14px 36px', borderRadius: t.radius.sm,
                  fontSize: 16, fontWeight: 600, color: t.fg, border: 'none', cursor: 'pointer',
                  background: t.brand500, boxShadow: t.shadow.button, fontFamily: t.font,
                  transition: `all 150ms ${t.ease}`,
                }}
                onMouseOver={e => { e.currentTarget.style.background = t.brand600; e.currentTarget.style.boxShadow = t.shadow.buttonHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.currentTarget.style.background = t.brand500; e.currentTarget.style.boxShadow = t.shadow.button; e.currentTarget.style.transform = 'none'; }}
              >
                <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
                Connect Wallet
              </button>

              <p style={{ marginTop: 16, fontSize: 12, color: t.slate400 }}>
                Select a wallet, see the connecting animation, and get a success confirmation
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ (from apps/marketing/src/components/sections/FAQ.tsx) ────────── */

const faqItems = [
  {
    question: 'Is PartyLayer open source?',
    answer: 'Yes! PartyLayer is fully open source under the MIT license. You can view the source code, submit issues, and contribute on GitHub. We believe in transparency and community-driven development.',
  },
  {
    question: 'How does registry verification work?',
    answer: 'The wallet registry is a cryptographically signed JSON manifest containing metadata for each verified wallet. The SDK fetches this registry and validates signatures before displaying wallets to users. This prevents phishing attacks where malicious apps impersonate legitimate wallets.',
  },
  {
    question: 'Which networks are supported?',
    answer: 'PartyLayer supports all Canton networks including mainnet, testnet, and devnet environments. The SDK automatically detects the connected network and adapts accordingly. Each wallet adapter handles network-specific connection logic.',
  },
  {
    question: 'What error codes should I handle?',
    answer: 'Common error codes include WALLET_NOT_INSTALLED (wallet app not detected), USER_REJECTED (user declined connection), SESSION_EXPIRED (session timed out), and TRANSPORT_ERROR (communication failure). All errors are typed and documented in the SDK.',
  },
  {
    question: 'How is security tested?',
    answer: 'We run comprehensive security testing including registry signature verification, session hijacking prevention, and transport layer security. The SDK includes built-in protections against common attack vectors. See our security checklist in the docs.',
  },
  {
    question: 'How do I add a new wallet to the registry?',
    answer: 'Wallet providers can apply for registry inclusion by submitting a pull request to the PartyLayer repository. Requirements include implementing the standard adapter interface, passing conformance tests, and providing wallet metadata. See the wallet-provider-guide in our docs.',
  },
];

function FAQ() {
  const bp = useBreakpoint();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" style={{ padding: responsive(bp, '56px 0', '64px 0', '80px 0'), borderTop: `1px solid ${t.border}`, fontFamily: t.font }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: bp === 'mobile' ? 32 : 56 }}>
          <h2 style={{ fontSize: responsive(bp, '1.5rem', '1.75rem', '2rem'), lineHeight: 1.2, letterSpacing: '-0.015em', fontWeight: 700, color: t.fg, marginBottom: 12 }}>
            Frequently asked questions
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate500 }}>
            Everything you need to know about PartyLayer.
          </p>
        </div>

        {/* FAQ Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqItems.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} style={{
                borderRadius: t.radius.lg, border: `1px solid ${isOpen ? 'rgba(255,204,0,0.3)' : t.border}`,
                background: isOpen ? 'rgba(255,251,235,0.3)' : t.bg, overflow: 'hidden',
                transition: `all 150ms ${t.ease}`,
              }}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 20, textAlign: 'left', border: 'none', cursor: 'pointer',
                    background: 'transparent', fontFamily: t.font,
                  }}
                  aria-expanded={isOpen}
                >
                  <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6, color: t.fg, paddingRight: 16 }}>
                    {item.question}
                  </span>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: t.radius.sm,
                    background: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: `transform 150ms ${t.ease}`,
                    color: t.slate500,
                  }}>
                    <ChevronDown />
                  </span>
                </button>

                <div style={{
                  overflow: 'hidden',
                  maxHeight: isOpen ? 384 : 0,
                  transition: `all 220ms ${t.ease}`,
                }}>
                  <div style={{ padding: '0 20px 20px' }}>
                    <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate600, margin: 0 }}>{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: t.slate500 }}>
            Still have questions?{' '}
            <a href={`${GITHUB_URL}/discussions`} target="_blank" rel="noopener noreferrer"
              style={{ color: t.brand600, textDecoration: 'underline', textUnderlineOffset: 2 }}
              onMouseOver={e => { (e.target as HTMLElement).style.color = t.brand500; }}
              onMouseOut={e => { (e.target as HTMLElement).style.color = t.brand600; }}
            >
              Start a discussion on GitHub
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer (from apps/marketing/src/components/sections/Footer.tsx) ──── */

const footerLinks = [
  { label: 'GitHub', href: GITHUB_URL },
  { label: 'npm', href: NPM_URL },
  { label: 'Issues', href: `${GITHUB_URL}/issues` },
  { label: 'Discussions', href: `${GITHUB_URL}/discussions` },
  { label: 'License', href: `${GITHUB_URL}/blob/main/LICENSE` },
];

function Footer() {
  const bp = useBreakpoint();
  const year = new Date().getFullYear();

  return (
    <footer style={{ borderTop: `1px solid ${t.border}`, background: 'rgba(245,246,248,0.3)', fontFamily: t.font }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: responsive(bp, '32px 24px', '40px 24px', '48px 24px') }}>
        <div style={{ display: 'grid', gridTemplateColumns: bp === 'mobile' ? '1fr' : '1fr 1fr', gap: bp === 'mobile' ? 24 : 32, alignItems: bp === 'mobile' ? 'flex-start' : 'center' }}>
          {/* Branding */}
          <div style={{ textAlign: bp === 'mobile' ? 'center' : 'left' }}>
            <Logo size="lg" />
            <p style={{ marginTop: 16, fontSize: bp === 'mobile' ? 14 : 16, lineHeight: 1.6, color: t.slate500, maxWidth: 360, margin: bp === 'mobile' ? '16px auto 0' : undefined }}>
              One SDK for every Canton wallet. Open source, registry-backed, and built for developers.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', justifyContent: bp === 'mobile' ? 'center' : 'flex-end' }}>
            {footerLinks.map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 14, fontWeight: 500, color: t.slate500, textDecoration: 'none',
                  transition: `color 150ms ${t.ease}`,
                }}
                onMouseOver={e => { (e.currentTarget).style.color = t.fg; }}
                onMouseOut={e => { (e.currentTarget).style.color = t.slate500; }}
              >
                {link.label}
                <ExternalIcon />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{ marginTop: bp === 'mobile' ? 24 : 40, paddingTop: bp === 'mobile' ? 20 : 24, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', flexDirection: bp === 'mobile' ? 'column' : 'row', justifyContent: bp === 'mobile' ? 'center' : 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <p style={{ fontSize: 14, color: t.slate400, margin: 0 }}>
              &copy; {year} PartyLayer. MIT License.
            </p>

            {/* Built by Cayvox Labs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: t.slate400 }}>
              <span>Built by</span>
              <a href="https://cayvox.com" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 500, textDecoration: 'none' }}
              >
                <img
                  src="/Cayvox Logo gradian.svg"
                  alt="Cayvox Labs"
                  draggable={false}
                  style={{ height: 90, marginTop: -30, marginBottom: -30, marginLeft: -10 }}
                />
              </a>
              <span style={{ color: t.brand500 }}>&#10022;</span>
            </div>
          </div>

          {/* Contact */}
          <div style={{ marginTop: 16, textAlign: bp === 'mobile' ? 'center' : 'right' }}>
            <a href="mailto:info@cayvox.com"
              style={{ fontSize: 14, color: t.slate400, textDecoration: 'none', transition: `color 150ms ${t.ease}` }}
              onMouseOver={e => { (e.target as HTMLElement).style.color = t.brand600; }}
              onMouseOut={e => { (e.target as HTMLElement).style.color = t.slate400; }}
            >
              info@cayvox.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

function LandingContent() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);

  return (
    <>
      <GlobalStyles />
      <Background>
        <Nav onConnect={openModal} />
        <main>
          <Hero onConnect={openModal} />
          <ArchitectureShowcase />
          <ProofBar />
          <WalletGrid />
          <DeveloperQuickstart />
          <DemoCTA onConnect={openModal} />
          <FAQ />
        </main>
        <Footer />
      </Background>
      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={() => setModalOpen(false)}
        walletIcons={WALLET_LOGOS}
      />
    </>
  );
}

/* ─── Loading Skeleton (shown during SSR + hydration) ─────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#FFFFFF', fontFamily: t.font,
    }}>
      <img src="/favicon-new.svg" alt="" width={48} height={48} style={{ opacity: 0.7 }} />
      <div style={{
        width: 32, height: 32, border: `3px solid ${t.muted2}`,
        borderTopColor: t.brand500, borderRadius: '50%',
        animation: 'plSpin .7s linear infinite',
      }} />
      <style>{`@keyframes plSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Show loading skeleton until client-side JS hydrates.
  // PartyLayerKit needs browser APIs (window.canton.*) so we can't render it on server.
  if (!mounted) return <LoadingSkeleton />;

  return (
    <PartyLayerKit network="devnet" appName="PartyLayer" walletIcons={WALLET_LOGOS}>
      <LandingContent />
    </PartyLayerKit>
  );
}
