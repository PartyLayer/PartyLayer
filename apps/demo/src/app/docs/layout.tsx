'use client';

import { useState, useCallback, useEffect, useRef, createContext, useContext, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useBreakpoint, responsive } from '../hooks/useBreakpoint';

/* ─── Design Tokens ──────────────────────────────────────────────────────── */

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
    button: '0 1px 2px rgba(15,23,42,0.05)',
    buttonHover: '0 2px 4px rgba(15,23,42,0.08)',
  },
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

const d = {
  sidebarWidth: 260,
  contentMaxWidth: 780,
  codeBg: '#1E293B',
  codeFg: '#E2E8F0',
  tipBg: '#F0FDF4',
  tipBorder: '#BBF7D0',
  tipFg: '#166534',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnFg: '#92400E',
  noteBg: '#EFF6FF',
  noteBorder: '#BFDBFE',
  noteFg: '#1E40AF',
};

/* ─── Sidebar Navigation ────────────────────────────────────────────────── */

const SIDEBAR_NAV = [
  {
    category: 'Overview',
    items: [
      { label: 'Introduction', href: '/docs/introduction' },
      { label: 'Installation', href: '/docs/installation' },
      { label: 'Quick Start', href: '/docs/quick-start' },
    ],
  },
  {
    category: 'Components',
    items: [
      { label: 'PartyLayerKit', href: '/docs/partylayer-kit' },
      { label: 'ConnectButton', href: '/docs/connect-button' },
      { label: 'WalletModal', href: '/docs/wallet-modal' },
      { label: 'Theming', href: '/docs/theming' },
    ],
  },
  {
    category: 'API Reference',
    items: [
      { label: 'React Hooks', href: '/docs/hooks' },
      { label: 'Vanilla JS', href: '/docs/vanilla-js' },
      { label: 'Wallets & Adapters', href: '/docs/wallets' },
      { label: 'CIP-0103 Provider', href: '/docs/cip-0103' },
    ],
  },
  {
    category: 'Guides',
    items: [
      { label: 'Error Handling', href: '/docs/error-handling' },
      { label: 'TypeScript Types', href: '/docs/typescript' },
      { label: 'Wallet Balances', href: '/docs/wallet-balances' },
      { label: 'Token Transfers', href: '/docs/token-transfers' },
      { label: 'Advanced', href: '/docs/advanced' },
    ],
  },
];

/* Flatten for prev/next navigation */
const ALL_PAGES = SIDEBAR_NAV.flatMap(g => g.items);

/* ─── Search Index ─────────────────────────────────────────────────────── */

interface SearchEntry {
  title: string;
  section?: string;
  href: string;
  keywords: string[];
}

const SEARCH_INDEX: SearchEntry[] = [
  // Overview
  { title: 'Introduction', href: '/docs/introduction', keywords: ['overview', 'what is', 'features', 'getting started', 'partylayer'] },
  { title: 'Installation', href: '/docs/installation', keywords: ['install', 'npm', 'pnpm', 'yarn', 'setup', 'peer dependencies', 'package'] },
  { title: 'Quick Start', href: '/docs/quick-start', keywords: ['quickstart', 'tutorial', 'hello world', 'first app', 'setup'] },

  // Components
  { title: 'PartyLayerKit', href: '/docs/partylayer-kit', keywords: ['kit', 'provider', 'wrapper', 'zero-config', 'component'] },
  { title: 'Props', section: 'PartyLayerKit', href: '/docs/partylayer-kit#props', keywords: ['network', 'appName', 'adapters', 'theme', 'walletIcons'] },
  { title: 'ConnectButton', href: '/docs/connect-button', keywords: ['button', 'connect', 'wallet', 'component', 'UI'] },
  { title: 'Button States', section: 'ConnectButton', href: '/docs/connect-button#states', keywords: ['disconnected', 'connecting', 'connected', 'dropdown'] },
  { title: 'Connected Label Formats', section: 'ConnectButton', href: '/docs/connect-button#connected-label', keywords: ['address', 'wallet name', 'custom', 'formatAddress'] },
  { title: 'WalletModal', href: '/docs/wallet-modal', keywords: ['modal', 'dialog', 'wallet selection', 'popup'] },
  { title: 'Modal Flow States', section: 'WalletModal', href: '/docs/wallet-modal#flow-states', keywords: ['wallet list', 'connecting', 'success', 'error', 'not installed'] },
  { title: 'Theming', href: '/docs/theming', keywords: ['theme', 'light', 'dark', 'auto', 'colors', 'custom theme', 'design'] },
  { title: 'Built-in Themes', section: 'Theming', href: '/docs/theming#built-in-themes', keywords: ['light', 'dark', 'auto', 'prefers-color-scheme'] },
  { title: 'Custom Theme', section: 'Theming', href: '/docs/theming#custom-theme', keywords: ['custom', 'colors', 'borderRadius', 'fontFamily'] },
  { title: 'PartyLayerTheme Interface', section: 'Theming', href: '/docs/theming#theme-interface', keywords: ['interface', 'type', 'colors', 'primary', 'background', 'surface'] },
  { title: 'useTheme', section: 'Theming', href: '/docs/theming#accessing-theme', keywords: ['hook', 'theme', 'access'] },

  // React Hooks
  { title: 'React Hooks', href: '/docs/hooks', keywords: ['hooks', 'react', 'API'] },
  { title: 'usePartyLayer', section: 'React Hooks', href: '/docs/hooks#use-party-layer', keywords: ['client', 'hook', 'instance', 'advanced'] },
  { title: 'useSession', section: 'React Hooks', href: '/docs/hooks#use-session', keywords: ['session', 'connected', 'partyId', 'walletId', 'hook'] },
  { title: 'useWallets', section: 'React Hooks', href: '/docs/hooks#use-wallets', keywords: ['wallets', 'list', 'available', 'loading', 'hook'] },
  { title: 'useConnect', section: 'React Hooks', href: '/docs/hooks#use-connect', keywords: ['connect', 'wallet', 'hook', 'isConnecting'] },
  { title: 'useDisconnect', section: 'React Hooks', href: '/docs/hooks#use-disconnect', keywords: ['disconnect', 'hook', 'isDisconnecting'] },
  { title: 'useSignMessage', section: 'React Hooks', href: '/docs/hooks#use-sign-message', keywords: ['sign', 'message', 'signature', 'hook'] },
  { title: 'useSignTransaction', section: 'React Hooks', href: '/docs/hooks#use-sign-transaction', keywords: ['sign', 'transaction', 'hook', 'tx'] },
  { title: 'useSubmitTransaction', section: 'React Hooks', href: '/docs/hooks#use-submit-transaction', keywords: ['submit', 'transaction', 'hook', 'receipt'] },
  { title: 'useRegistryStatus', section: 'React Hooks', href: '/docs/hooks#use-registry-status', keywords: ['registry', 'status', 'refresh', 'hook'] },
  { title: 'useWalletIcons', section: 'React Hooks', href: '/docs/hooks#use-wallet-icons', keywords: ['icons', 'wallet', 'hook', 'images'] },

  // Vanilla JS
  { title: 'Vanilla JS', href: '/docs/vanilla-js', keywords: ['vanilla', 'javascript', 'client', 'no react', 'SDK'] },
  { title: 'createPartyLayer', section: 'Vanilla JS', href: '/docs/vanilla-js#create-client', keywords: ['create', 'client', 'config', 'initialize'] },
  { title: 'Configuration Options', section: 'Vanilla JS', href: '/docs/vanilla-js#config', keywords: ['config', 'network', 'app', 'registryUrl', 'storage', 'crypto'] },
  { title: 'listWallets', section: 'Vanilla JS', href: '/docs/vanilla-js#wallet-management', keywords: ['list', 'wallets', 'filter', 'registry'] },
  { title: 'connect / disconnect', section: 'Vanilla JS', href: '/docs/vanilla-js#session-management', keywords: ['connect', 'disconnect', 'session', 'getActiveSession'] },
  { title: 'signMessage', section: 'Vanilla JS', href: '/docs/vanilla-js#signing', keywords: ['sign', 'message', 'signature', 'nonce', 'domain'] },
  { title: 'signTransaction', section: 'Vanilla JS', href: '/docs/vanilla-js#signing', keywords: ['sign', 'transaction', 'tx', 'hash'] },
  { title: 'submitTransaction', section: 'Vanilla JS', href: '/docs/vanilla-js#signing', keywords: ['submit', 'transaction', 'receipt', 'commandId'] },
  { title: 'Events', section: 'Vanilla JS', href: '/docs/vanilla-js#events', keywords: ['events', 'on', 'subscribe', 'session:connected', 'tx:status', 'error'] },
  { title: 'CIP-0103 Bridge', section: 'Vanilla JS', href: '/docs/vanilla-js#cip0103-bridge', keywords: ['cip-0103', 'provider', 'bridge', 'asProvider'] },
  { title: 'client.destroy()', section: 'Vanilla JS', href: '/docs/vanilla-js#cleanup', keywords: ['destroy', 'cleanup', 'unmount', 'memory leak'] },

  // Wallets & Adapters
  { title: 'Wallets & Adapters', href: '/docs/wallets', keywords: ['wallets', 'adapters', 'built-in', 'custom'] },
  { title: 'Built-in Wallets', section: 'Wallets & Adapters', href: '/docs/wallets#built-in-wallets', keywords: ['console', 'loop', 'cantor8', 'nightly', 'bron'] },
  { title: 'Wallet Discovery', section: 'Wallets & Adapters', href: '/docs/wallets#discovery', keywords: ['discovery', 'registry', 'CIP-0103', 'native', 'detection'] },
  { title: 'Custom Adapter', section: 'Wallets & Adapters', href: '/docs/wallets#custom-adapter', keywords: ['custom', 'adapter', 'WalletAdapter', 'interface', 'implement'] },
  { title: 'WalletAdapter Interface', section: 'Wallets & Adapters', href: '/docs/wallets#adapter-interface', keywords: ['interface', 'detectInstalled', 'connect', 'signMessage', 'ledgerApi'] },
  { title: 'getBuiltinAdapters', section: 'Wallets & Adapters', href: '/docs/wallets#builtin-adapters-function', keywords: ['builtin', 'adapters', 'default', 'ConsoleAdapter'] },

  // CIP-0103
  { title: 'CIP-0103 Provider', href: '/docs/cip-0103', keywords: ['cip-0103', 'canton', 'standard', 'provider', 'dApp'] },
  { title: 'Provider Methods', section: 'CIP-0103', href: '/docs/cip-0103#methods', keywords: ['request', 'connect', 'listAccounts', 'getPrimaryAccount', 'signMessage', 'prepareExecute', 'ledgerApi'] },
  { title: 'Provider Events', section: 'CIP-0103', href: '/docs/cip-0103#events', keywords: ['statusChanged', 'accountsChanged', 'txChanged', 'connected'] },
  { title: 'asProvider() Bridge', section: 'CIP-0103', href: '/docs/cip-0103#bridge', keywords: ['bridge', 'asProvider', 'PartyLayerClient', 'wrapper'] },
  { title: 'discoverInjectedProviders', section: 'CIP-0103', href: '/docs/cip-0103#discovery', keywords: ['discover', 'injected', 'window.canton', 'native'] },
  { title: 'ProviderRpcError', section: 'CIP-0103', href: '/docs/cip-0103#errors', keywords: ['error', 'RPC', 'EIP-1193', 'code', 'ProviderRpcError'] },

  // Error Handling
  { title: 'Error Handling', href: '/docs/error-handling', keywords: ['error', 'catch', 'try', 'handling', 'PartyLayerError'] },
  { title: 'Error Codes', section: 'Error Handling', href: '/docs/error-handling#error-codes', keywords: ['WALLET_NOT_FOUND', 'USER_REJECTED', 'TIMEOUT', 'TRANSPORT_ERROR', 'SESSION_EXPIRED'] },
  { title: 'Try-Catch Patterns', section: 'Error Handling', href: '/docs/error-handling#try-catch', keywords: ['try', 'catch', 'instanceof', 'pattern'] },
  { title: 'Error Events', section: 'Error Handling', href: '/docs/error-handling#error-events', keywords: ['error', 'event', 'subscribe', 'isOperational'] },

  // TypeScript Types
  { title: 'TypeScript Types', href: '/docs/typescript', keywords: ['typescript', 'types', 'interfaces', 'branded'] },
  { title: 'Branded Types', section: 'TypeScript Types', href: '/docs/typescript#branded-types', keywords: ['WalletId', 'PartyId', 'SessionId', 'TransactionHash', 'Signature', 'NetworkId'] },
  { title: 'Session', section: 'TypeScript Types', href: '/docs/typescript#session', keywords: ['session', 'interface', 'partyId', 'walletId', 'createdAt', 'expiresAt'] },
  { title: 'WalletInfo', section: 'TypeScript Types', href: '/docs/typescript#wallet-info', keywords: ['WalletInfo', 'interface', 'capabilities', 'icons', 'installHints'] },
  { title: 'Signing Types', section: 'TypeScript Types', href: '/docs/typescript#signing-types', keywords: ['SignedMessage', 'SignedTransaction', 'TxReceipt', 'signature'] },
  { title: 'CapabilityKey', section: 'TypeScript Types', href: '/docs/typescript#capabilities', keywords: ['capability', 'connect', 'signMessage', 'signTransaction', 'ledgerApi'] },
  { title: 'TransactionStatus', section: 'TypeScript Types', href: '/docs/typescript#transaction-status', keywords: ['pending', 'submitted', 'committed', 'rejected', 'failed'] },
  { title: 'Event Types', section: 'TypeScript Types', href: '/docs/typescript#event-types', keywords: ['event', 'SessionConnectedEvent', 'TxStatusEvent', 'ErrorEvent'] },

  // Advanced
  { title: 'Advanced', href: '/docs/advanced', keywords: ['advanced', 'telemetry', 'security', 'production'] },
  { title: 'Telemetry', section: 'Advanced', href: '/docs/advanced#telemetry', keywords: ['telemetry', 'metrics', 'opt-in', 'privacy', 'analytics'] },
  { title: 'Session Persistence', section: 'Advanced', href: '/docs/advanced#session-persistence', keywords: ['session', 'persistence', 'localStorage', 'storage', 'encrypted'] },
  { title: 'Custom Storage', section: 'Advanced', href: '/docs/advanced#custom-storage', keywords: ['storage', 'custom', 'adapter', 'get', 'set', 'remove'] },
  { title: 'Registry Internals', section: 'Advanced', href: '/docs/advanced#registry', keywords: ['registry', 'signed', 'manifest', 'cache', 'verification', 'fallback'] },
  { title: 'Security', section: 'Advanced', href: '/docs/advanced#security', keywords: ['security', 'CSP', 'origin', 'transport', 'encryption'] },
  { title: 'Production Checklist', section: 'Advanced', href: '/docs/advanced#production-checklist', keywords: ['production', 'checklist', 'deploy', 'best practices'] },
];

function searchDocs(query: string): SearchEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const scored = SEARCH_INDEX.map(entry => {
    const titleLower = entry.title.toLowerCase();
    const sectionLower = (entry.section || '').toLowerCase();
    let score = 0;
    if (titleLower === q) score = 100;
    else if (titleLower.startsWith(q)) score = 80;
    else if (titleLower.includes(q)) score = 60;
    else if (entry.keywords.some(k => k.startsWith(q))) score = 40;
    else if (entry.keywords.some(k => k.includes(q))) score = 30;
    else if (sectionLower.includes(q)) score = 20;
    else {
      const words = q.split(/\s+/);
      const allMatch = words.every(w =>
        titleLower.includes(w) || sectionLower.includes(w) || entry.keywords.some(k => k.includes(w))
      );
      if (allMatch) score = 25;
    }
    return { entry, score };
  }).filter(r => r.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map(r => r.entry);
}

/* ─── Doc Components Context ─────────────────────────────────────────────── */

interface DocComponents {
  H1: (p: { children: ReactNode }) => ReactNode;
  H2: (p: { children: ReactNode; id?: string }) => ReactNode;
  H3: (p: { children: ReactNode; id?: string }) => ReactNode;
  P: (p: { children: ReactNode }) => ReactNode;
  Code: (p: { children: string }) => ReactNode;
  CodeBlock: (p: { language?: string; title?: string; children: string }) => ReactNode;
  PropsTable: (p: { data: { prop: string; type: string; default?: string; description: string }[] }) => ReactNode;
  Callout: (p: { type?: 'tip' | 'warning' | 'note'; title?: string; children: ReactNode }) => ReactNode;
  TabGroup: (p: { tabs: { label: string; content: string; language?: string }[] }) => ReactNode;
  PrevNext: () => ReactNode;
  UL: (p: { children: ReactNode }) => ReactNode;
  OL: (p: { children: ReactNode }) => ReactNode;
  LI: (p: { children: ReactNode }) => ReactNode;
  HR: () => ReactNode;
  A: (p: { href: string; children: ReactNode }) => ReactNode;
  Strong: (p: { children: ReactNode }) => ReactNode;
}

const DocContext = createContext<DocComponents | null>(null);

export function useDocs(): DocComponents {
  const ctx = useContext(DocContext);
  if (!ctx) throw new Error('useDocs must be used within DocsLayout');
  return ctx;
}

/* ─── Layout Component ───────────────────────────────────────────────────── */

export default function DocsLayout({ children }: { children: ReactNode }) {
  const bp = useBreakpoint();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Platform shortcut marker — start with 'Ctrl+' so SSR and first client render
  // match, then upgrade to '⌘' on Mac after mount. Prevents React hydration #425.
  const [shortcutPrefix, setShortcutPrefix] = useState<'⌘' | 'Ctrl+'>('Ctrl+');
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)) {
      setShortcutPrefix('⌘');
    }
  }, []);

  /* Cmd+K / Ctrl+K shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const currentIdx = ALL_PAGES.findIndex(p => p.href === pathname);
  const prev = currentIdx > 0 ? ALL_PAGES[currentIdx - 1] : null;
  const next = currentIdx < ALL_PAGES.length - 1 ? ALL_PAGES[currentIdx + 1] : null;

  /* ── Shared doc components ── */
  const H1 = useCallback(({ children: c }: { children: ReactNode }) => (
    <h1 style={{ fontSize: responsive(bp, 26, 28, 32), fontWeight: 700, letterSpacing: '-0.02em', color: t.fg, marginBottom: 8, lineHeight: 1.2, fontFamily: t.font }}>{c}</h1>
  ), [bp]);

  const H2 = useCallback(({ children: c, id }: { children: ReactNode; id?: string }) => (
    <h2 id={id} style={{ fontSize: responsive(bp, 20, 22, 24), fontWeight: 600, color: t.fg, marginTop: responsive(bp, 32, 40, 48), marginBottom: 16, paddingTop: responsive(bp, 16, 20, 24), borderTop: `1px solid ${t.border}`, lineHeight: 1.3, fontFamily: t.font }}>{c}</h2>
  ), [bp]);

  const H3 = useCallback(({ children: c, id }: { children: ReactNode; id?: string }) => (
    <h3 id={id} style={{ fontSize: responsive(bp, 16, 17, 18), fontWeight: 600, color: t.fg, marginTop: responsive(bp, 24, 28, 32), marginBottom: 12, lineHeight: 1.4, fontFamily: t.font }}>{c}</h3>
  ), [bp]);

  const P = useCallback(({ children: c }: { children: ReactNode }) => (
    <p style={{ fontSize: responsive(bp, 14, 15, 15), lineHeight: 1.7, color: t.slate600, marginBottom: 16, fontFamily: t.font }}>{c}</p>
  ), [bp]);

  const Code = useCallback(({ children: c }: { children: string }) => (
    <code style={{
      fontSize: 13.5, fontFamily: t.mono, padding: '2px 6px',
      background: t.brand50, border: `1px solid ${t.brand100}`,
      borderRadius: 5, color: t.slate700,
    }}>{c}</code>
  ), []);

  const CodeBlock = useCallback(({ language, title, children: c }: { language?: string; title?: string; children: string }) => (
    <CodeBlockComponent language={language} title={title}>{c}</CodeBlockComponent>
  ), []);

  const PropsTable = useCallback(({ data }: { data: { prop: string; type: string; default?: string; description: string }[] }) => {
    if (bp === 'mobile') {
      return (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(row => (
            <div key={row.prop} style={{
              border: `1px solid ${t.border}`, borderRadius: t.radius.sm,
              padding: '12px 14px', background: t.bg,
            }}>
              <div style={{ fontFamily: t.mono, fontSize: 13, color: t.brand600, fontWeight: 600, marginBottom: 8 }}>{row.prop}</div>
              <div style={{ fontSize: 12, color: t.slate500, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: t.slate600 }}>Type: </span>
                <code style={{ fontFamily: t.mono, fontSize: 12 }}>{row.type}</code>
              </div>
              {row.default && (
                <div style={{ fontSize: 12, color: t.slate500, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: t.slate600 }}>Default: </span>
                  <code style={{ fontFamily: t.mono, fontSize: 12 }}>{row.default}</code>
                </div>
              )}
              <div style={{ fontSize: 13, color: t.slate600, marginTop: 6, lineHeight: 1.5 }}>{row.description}</div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: t.font,
          border: `1px solid ${t.border}`, borderRadius: t.radius.sm, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: t.muted }}>
              {['Prop', 'Type', 'Default', 'Description'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: t.fg, borderBottom: `1px solid ${t.border}`, fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.prop} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: '10px 14px', fontFamily: t.mono, fontSize: 13, color: t.brand600, fontWeight: 500 }}>{row.prop}</td>
                <td style={{ padding: '10px 14px', fontFamily: t.mono, fontSize: 12.5, color: t.slate600 }}>{row.type}</td>
                <td style={{ padding: '10px 14px', fontFamily: t.mono, fontSize: 12.5, color: t.slate500 }}>{row.default || '—'}</td>
                <td style={{ padding: '10px 14px', color: t.slate600, fontSize: 13.5 }}>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [bp]);

  const Callout = useCallback(({ type = 'tip', title, children: c }: { type?: 'tip' | 'warning' | 'note'; title?: string; children: ReactNode }) => {
    const styles = {
      tip: { bg: d.tipBg, border: d.tipBorder, fg: d.tipFg, icon: '💡', defaultTitle: 'Tip' },
      warning: { bg: d.warnBg, border: d.warnBorder, fg: d.warnFg, icon: '⚠️', defaultTitle: 'Warning' },
      note: { bg: d.noteBg, border: d.noteBorder, fg: d.noteFg, icon: 'ℹ️', defaultTitle: 'Note' },
    }[type];
    return (
      <div style={{
        padding: responsive(bp, '12px 14px', '14px 16px', '14px 16px'), marginBottom: 24, borderRadius: t.radius.sm,
        background: styles.bg, borderLeft: `3px solid ${styles.border}`,
        fontSize: responsive(bp, 13, 14, 14), lineHeight: 1.6, color: t.slate700, fontFamily: t.font,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: styles.fg }}>
          {styles.icon} {title || styles.defaultTitle}
        </div>
        {c}
      </div>
    );
  }, [bp]);

  const TabGroup = useCallback(({ tabs }: { tabs: { label: string; content: string; language?: string }[] }) => (
    <TabGroupComponent tabs={tabs} />
  ), []);

  const PrevNext = useCallback(() => (
    <div style={{
      display: 'flex', flexDirection: bp === 'mobile' ? 'column' : 'row',
      justifyContent: 'space-between', marginTop: responsive(bp, 40, 52, 64),
      paddingTop: 24, borderTop: `1px solid ${t.border}`,
      gap: bp === 'mobile' ? 12 : undefined,
    }}>
      {prev ? (
        <Link href={prev.href} style={{
          display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none',
          padding: '12px 16px', borderRadius: t.radius.sm, border: `1px solid ${t.border}`,
          transition: `all 150ms ${t.ease}`, maxWidth: bp === 'mobile' ? '100%' : '45%',
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = t.brand500; e.currentTarget.style.background = t.brand50; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 12, color: t.slate500, fontFamily: t.font }}>Previous</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.fg, fontFamily: t.font }}>{prev.label}</span>
        </Link>
      ) : <div />}
      {next ? (
        <Link href={next.href} style={{
          display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none',
          padding: '12px 16px', borderRadius: t.radius.sm, border: `1px solid ${t.border}`,
          transition: `all 150ms ${t.ease}`, textAlign: bp === 'mobile' ? 'left' : 'right',
          maxWidth: bp === 'mobile' ? '100%' : '45%',
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = t.brand500; e.currentTarget.style.background = t.brand50; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 12, color: t.slate500, fontFamily: t.font }}>Next</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.fg, fontFamily: t.font }}>{next.label}</span>
        </Link>
      ) : <div />}
    </div>
  ), [prev, next, bp]);

  const UL = useCallback(({ children: c }: { children: ReactNode }) => (
    <ul style={{ paddingLeft: 24, marginBottom: 16, fontSize: responsive(bp, 14, 15, 15), lineHeight: 1.7, color: t.slate600, fontFamily: t.font }}>{c}</ul>
  ), [bp]);

  const OL = useCallback(({ children: c }: { children: ReactNode }) => (
    <ol style={{ paddingLeft: 24, marginBottom: 16, fontSize: responsive(bp, 14, 15, 15), lineHeight: 1.7, color: t.slate600, fontFamily: t.font }}>{c}</ol>
  ), [bp]);

  const LI = useCallback(({ children: c }: { children: ReactNode }) => (
    <li style={{ marginBottom: 6 }}>{c}</li>
  ), []);

  const HR = useCallback(() => (
    <hr style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '32px 0' }} />
  ), []);

  const A = useCallback(({ href, children: c }: { href: string; children: ReactNode }) => {
    const isExternal = href.startsWith('http');
    const style: CSSProperties = { color: t.brand600, textDecoration: 'none', fontWeight: 500, borderBottom: `1px solid ${t.brand100}` };
    if (isExternal) {
      return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{c}</a>;
    }
    return <Link href={href} style={style}>{c}</Link>;
  }, []);

  const Strong = useCallback(({ children: c }: { children: ReactNode }) => (
    <strong style={{ fontWeight: 600, color: t.fg }}>{c}</strong>
  ), []);

  const components: DocComponents = { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, TabGroup, PrevNext, UL, OL, LI, HR, A, Strong };

  return (
    <DocContext.Provider value={components}>
      <div style={{ fontFamily: t.font, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${t.border}`, height: 56,
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto', padding: '0 24px',
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                className="docs-mobile-toggle"
              >
                <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke={t.slate600} strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Logo */}
              <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                <img src="/partylayer.xyz.svg" alt="PartyLayer" draggable={false}
                  style={{ height: bp === 'mobile' ? 72 : 96, marginTop: bp === 'mobile' ? -25 : -35, marginBottom: bp === 'mobile' ? -25 : -35, marginLeft: bp === 'mobile' ? -7 : -9 }} />
              </Link>
              <span style={{ fontSize: 13, fontWeight: 500, color: t.slate400, padding: '3px 8px', background: t.muted, borderRadius: 6 }}>Docs</span>
            </div>

            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="docs-search-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px 7px 10px', borderRadius: 8,
                border: `1px solid ${t.border}`, background: t.muted,
                cursor: 'pointer', transition: `all 150ms ${t.ease}`,
                flex: '0 1 320px', minWidth: 0,
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = t.slate300; e.currentTarget.style.background = t.muted2; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.muted; }}
            >
              <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke={t.slate400} strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 13, color: t.slate400, fontFamily: t.font, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Search docs...
              </span>
              <kbd style={{
                fontSize: 11, fontFamily: t.mono, color: t.slate400,
                padding: '2px 6px', borderRadius: 4, border: `1px solid ${t.border}`,
                background: t.bg, lineHeight: 1, flexShrink: 0,
              }}>
                {shortcutPrefix}K
              </kbd>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <a href="https://github.com/PartyLayer/PartyLayer" target="_blank" rel="noopener noreferrer"
                style={{ color: t.slate500, display: 'flex', alignItems: 'center' }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <Link href="/kit-demo"
                style={{
                  fontSize: 13, fontWeight: 600, color: t.fg, textDecoration: 'none',
                  padding: '6px 14px', borderRadius: t.radius.sm,
                  background: t.brand500, transition: `all 150ms ${t.ease}`,
                  display: bp === 'mobile' ? 'none' : undefined,
                }}
                onMouseOver={e => { e.currentTarget.style.background = t.brand600; }}
                onMouseOut={e => { e.currentTarget.style.background = t.brand500; }}
              >
                Try Demo
              </Link>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          {/* Sidebar */}
          <aside
            className={`docs-sidebar${mobileOpen ? ' docs-sidebar-open' : ''}`}
            style={{
              width: d.sidebarWidth, flexShrink: 0,
              borderRight: `1px solid ${t.border}`,
              padding: '24px 0', overflowY: 'auto',
              position: 'sticky', top: 56, height: 'calc(100vh - 56px)',
            }}
          >
            <nav style={{ padding: '0 16px' }}>
              {SIDEBAR_NAV.map(group => (
                <div key={group.category} style={{ marginBottom: 24 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: t.slate400,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '0 12px', marginBottom: 8,
                  }}>
                    {group.category}
                  </div>
                  {group.items.map(item => {
                    const isActive = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href}
                        onClick={() => setMobileOpen(false)}
                        style={{
                          display: 'block', padding: '7px 12px', borderRadius: 8,
                          fontSize: 14, fontWeight: isActive ? 600 : 400,
                          color: isActive ? t.fg : t.slate600,
                          background: isActive ? t.brand50 : 'transparent',
                          textDecoration: 'none', transition: `all 100ms ${t.ease}`,
                          borderLeft: isActive ? `2px solid ${t.brand500}` : '2px solid transparent',
                        }}
                        onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = t.muted; e.currentTarget.style.color = t.fg; } }}
                        onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.slate600; } }}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Back to home */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
              <Link href="/" style={{ fontSize: 13, color: t.slate500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Home
              </Link>
            </div>
          </aside>

          {/* Main content */}
          <main style={{
            flex: 1, maxWidth: d.contentMaxWidth,
            padding: responsive(bp, '24px 16px 48px', '32px 32px 64px', '40px 48px 80px'),
            minHeight: 'calc(100vh - 56px)',
          }}>
            {children}
          </main>
        </div>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(href) => { setSearchOpen(false); router.push(href); }}
        />
      )}

      {/* Mobile sidebar overlay backdrop */}
      {mobileOpen && bp !== 'desktop' && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, top: 56, zIndex: 29,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Mobile sidebar styles + responsive tweaks */}
      <style>{`
        .docs-mobile-toggle { display: none !important; }
        @media (max-width: 868px) {
          .docs-mobile-toggle { display: block !important; }
          .docs-search-btn { flex: 0 1 40px !important; overflow: hidden !important; }
          .docs-search-btn span, .docs-search-btn kbd { display: none !important; }
          .docs-sidebar { display: none !important; }
          .docs-sidebar.docs-sidebar-open {
            display: block !important;
            position: fixed !important;
            top: 56px !important;
            left: 0 !important;
            width: 280px !important;
            height: calc(100vh - 56px) !important;
            z-index: 30 !important;
            background: #fff !important;
            border-right: 1px solid rgba(15,23,42,0.10) !important;
            box-shadow: 4px 0 24px rgba(0,0,0,0.08) !important;
            overflow-y: auto !important;
          }
        }
      `}</style>
    </DocContext.Provider>
  );
}

/* ─── CodeBlock Component ────────────────────────────────────────────────── */

function CodeBlockComponent({ language, title, children }: { language?: string; title?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const cbBp = useBreakpoint();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  return (
    <div style={{ marginBottom: 24, borderRadius: t.radius.sm, overflow: 'hidden', border: `1px solid rgba(30,41,59,0.8)` }}>
      {(title || language) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: responsive(cbBp, '8px 12px', '8px 16px', '8px 16px'), background: '#0F172A', borderBottom: '1px solid rgba(148,163,184,0.15)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: t.slate400, fontFamily: t.font }}>
            {title || language}
          </span>
          <button onClick={handleCopy} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? '#34D399' : t.slate400, fontSize: 12, fontFamily: t.font,
            display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4,
            transition: `color 150ms ${t.ease}`,
          }}>
            {copied ? (
              <>
                <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
                Copied
              </>
            ) : (
              <>
                <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copy
              </>
            )}
          </button>
        </div>
      )}
      <pre style={{
        margin: 0, padding: responsive(cbBp, '12px 14px', '14px 16px', '14px 16px'), background: d.codeBg,
        overflowX: 'auto', fontSize: responsive(cbBp, 12, 13, 13.5), lineHeight: 1.6,
        fontFamily: t.mono, color: d.codeFg,
      }}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ─── Search Modal Component ────────────────────────────────────────────── */

function SearchModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const smBp = useBreakpoint();
  const results = searchDocs(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && results[activeIdx]) { onNavigate(results[activeIdx].href); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [results, activeIdx, onClose, onNavigate]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIdx] as HTMLElement | undefined;
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15, 23, 42, 0.40)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'min(20vh, 140px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: smBp === 'mobile' ? 'calc(100% - 32px)' : 560, borderRadius: 14,
          background: t.bg, boxShadow: '0 16px 70px rgba(0,0,0,0.15), 0 0 0 1px rgba(15,23,42,0.08)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: 'min(70vh, 480px)',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderBottom: `1px solid ${t.border}`,
        }}>
          <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke={t.slate400} strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documentation..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 15, color: t.fg, fontFamily: t.font,
            }}
          />
          <kbd style={{
            fontSize: 11, fontFamily: t.mono, color: t.slate400,
            padding: '3px 7px', borderRadius: 5, border: `1px solid ${t.border}`,
            background: t.muted, lineHeight: 1,
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 8px' }}>
          {query && results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: t.slate500, fontSize: 14, fontFamily: t.font }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {!query && (
            <div style={{ padding: '16px', color: t.slate500, fontSize: 13, fontFamily: t.font }}>
              Start typing to search across all documentation pages...
            </div>
          )}
          {results.map((entry, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={entry.href}
                onClick={() => onNavigate(entry.href)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: isActive ? t.brand50 : 'transparent',
                  transition: `background 80ms ${t.ease}`,
                  fontFamily: t.font,
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? t.brand100 : t.muted,
                }}>
                  {entry.section ? (
                    <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke={isActive ? t.brand600 : t.slate400} strokeWidth={2} strokeLinecap="round">
                      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                    </svg>
                  ) : (
                    <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke={isActive ? t.brand600 : t.slate400} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  )}
                </div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: isActive ? t.fg : t.slate700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {highlightMatch(entry.title, query)}
                  </div>
                  {entry.section && (
                    <div style={{ fontSize: 12, color: t.slate400, marginTop: 1 }}>
                      {entry.section}
                    </div>
                  )}
                </div>
                {/* Arrow */}
                <svg width={14} height={14} fill="none" viewBox="0 0 24 24"
                  stroke={isActive ? t.brand600 : t.slate300} strokeWidth={2} strokeLinecap="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {query && results.length > 0 && (
          <div style={{
            display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center',
            padding: '10px 16px', borderTop: `1px solid ${t.border}`,
            fontSize: 11, color: t.slate400, fontFamily: t.font,
          }}>
            <span><kbd style={{ fontFamily: t.mono, padding: '1px 4px', border: `1px solid ${t.border}`, borderRadius: 3, background: t.muted, fontSize: 10 }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ fontFamily: t.mono, padding: '1px 4px', border: `1px solid ${t.border}`, borderRadius: 3, background: t.muted, fontSize: 10 }}>↵</kbd> select</span>
            <span><kbd style={{ fontFamily: t.mono, padding: '1px 4px', border: `1px solid ${t.border}`, borderRadius: 3, background: t.muted, fontSize: 10 }}>esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: t.brand100, borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ─── TabGroup Component ─────────────────────────────────────────────────── */

function TabGroupComponent({ tabs }: { tabs: { label: string; content: string; language?: string }[] }) {
  const [active, setActive] = useState(0);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: 0 }}>
        {tabs.map((tab, i) => (
          <button key={tab.label} onClick={() => setActive(i)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              fontFamily: t.font, cursor: 'pointer',
              background: 'none', border: 'none',
              color: i === active ? t.fg : t.slate500,
              borderBottom: i === active ? `2px solid ${t.brand500}` : '2px solid transparent',
              transition: `all 100ms ${t.ease}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CodeBlockComponent language={tabs[active].language}>
        {tabs[active].content}
      </CodeBlockComponent>
    </div>
  );
}
