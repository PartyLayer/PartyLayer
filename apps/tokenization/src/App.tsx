/**
 * The Tokenization vertical example shell.
 *
 * PartyLayerKit provides the session + theme context (mirroring the react-vite
 * template's setup), themed with the `teal` trading family and a light/dark toggle.
 * The header carries the connect UI and a DEMO-PARTY switcher: switching the demo
 * party changes whose data every section reads and who acts. It is app state,
 * separate from the wallet session.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  PartyLayerKit,
  ConnectButton,
  SynchronizerSwitcher,
  themes,
  type SynchronizerOption,
} from '@partylayer/react';
// Every wallet this app registers comes from the shared set, so adding a wallet
// is one edit there rather than one per app. Wallet SDK pins live there too.
import { buildWalletAdapters, type BronAdapterConfig } from '@partylayer/demo-adapters';
import { DemoProvider } from './context/DemoContext';
import { demoBackend } from './lib/backend';
import { createLiveBackend, fetchGatewayParties } from './lib/liveBackend';
import { PARTIES, PARTY_ORDER } from './lib/fixtures';
import type { DemoPartyKey } from './lib/types';
import { Holdings } from './sections/Holdings';
import { Transfer } from './sections/Transfer';
import { Incoming } from './sections/Incoming';
import { Issuer } from './sections/Issuer';
import { Allocations } from './sections/Allocations';
import { RetryBanner } from './ui/RetryBanner';
import { CopyId } from './ui/primitives';
import './App.css';

// Every stable wallet gets its adapter so the connect surface can genuinely
// connect each one, not merely list it. The SDK hides any wallet whose adapter is
// absent (a click could only fail), so registering all of them is what makes the
// picker complete. The set itself lives in @partylayer/demo-adapters; this app
// takes it whole and excludes nothing. Console and Send are announce-native
// (installing the extension is enough), but the shared set registers their
// adapters too so a direct connect works here without relying on the announce
// event. Walley and Cauri are registered in factory form, so the SDK resolves each
// host from its registry entry's networkHosts for the active network and no wallet
// URL appears in app code. The demo-party switcher, not this connection, drives the
// section data; the app is fixed to devnet (see network="devnet" below).
//
// WalletConnect needs a WalletConnect Cloud project id. It reads one from the env
// and falls back to the shared public dev id (project ids are client identifiers,
// not secrets) so the demo shows a real pairing QR out of the box; override with
// VITE_WALLETCONNECT_PROJECT_ID.
const WC_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ||
  '577414f6b46f09a7383d3c306c013a57';

// Bron is an enterprise remote signer: it only works with real OAuth2 credentials
// (authorization + token URLs, client id, redirect uri) and an API base url, which
// a public demo cannot ship. Register it ONLY when those are supplied via env;
// otherwise the SDK hides it rather than showing a wallet whose click would dead-end
// at an OAuth error. Set the VITE_BRON_* vars (see .env.example) to enable it.
function makeBronConfig(): BronAdapterConfig | undefined {
  const env = import.meta.env;
  const authorizationUrl = env.VITE_BRON_AUTHORIZATION_URL as string | undefined;
  const tokenUrl = env.VITE_BRON_TOKEN_URL as string | undefined;
  const clientId = env.VITE_BRON_CLIENT_ID as string | undefined;
  const redirectUri = env.VITE_BRON_REDIRECT_URI as string | undefined;
  const baseUrl = env.VITE_BRON_API_URL as string | undefined;
  if (!authorizationUrl || !tokenUrl || !clientId || !redirectUri || !baseUrl) return undefined;
  return {
    auth: { authorizationUrl, tokenUrl, clientId, redirectUri, usePKCE: true },
    api: { baseUrl },
  };
}

const BRON_CONFIG = makeBronConfig();

const ADAPTERS = buildWalletAdapters({
  // Same value this app passes to PartyLayerKit below.
  network: 'devnet',
  walletConnectProjectId: WC_PROJECT_ID,
  bron: BRON_CONFIG,
});

// The demo only ever talks to Canton DevNet: live mode routes to the DevNet gateway and
// demo mode simulates it. List DevNet alone so the switcher cannot offer a network the app
// cannot actually reach. The switcher's visible label is derived from this networkId value,
// and the control carries an accessible name (aria-label Synchronizer) from the primitive.
const SYNCHRONIZERS: SynchronizerOption[] = [{ networkId: 'canton:da-devnet', label: 'DevNet' }];

const THEME_KEY = 'partylayer-tokenization-theme';

// Initial theme: a stored choice wins, otherwise follow the OS prefers-color-scheme. Guarded
// for non-browser contexts so the module stays import safe.
function initialThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(initialThemeMode);
  // Persist the theme choice so a reload keeps it; the initial value already honored it.
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, mode);
  }, [mode]);
  const [party, setParty] = useState<DemoPartyKey>('alice');
  const [synchronizer, setSynchronizer] = useState('canton:da-devnet');

  // Backend selection: demo (default, unchanged) or live (the DevNet gateway). The
  // browser never holds a ledger credential; live routes every read and submit to
  // the gateway at VITE_GATEWAY_URL.
  const isLive = import.meta.env.VITE_BACKEND === 'live';
  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || '';
  const backend = useMemo(() => (isLive ? createLiveBackend(gatewayUrl) : demoBackend), [isLive, gatewayUrl]);
  const [gatewayLabels, setGatewayLabels] = useState<Partial<Record<DemoPartyKey, string>>>({});
  useEffect(() => {
    if (isLive && gatewayUrl) fetchGatewayParties(gatewayUrl).then(setGatewayLabels);
  }, [isLive, gatewayUrl]);
  const label = (p: DemoPartyKey) => gatewayLabels[p] ?? PARTIES[p].label;

  const theme = mode === 'dark' ? themes.teal.dark : themes.teal.light;

  return (
    <PartyLayerKit network="devnet" appName="PartyLayer Tokenization" theme={theme} adapters={ADAPTERS}>
      <DemoProvider value={{ party, setParty, backend, mode }}>
        <div className={'app app-' + mode}>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <header className="topbar">
            <div className="brand">
              <a className="brand-logo" href="https://partylayer.xyz" target="_blank" rel="noopener">
                <img src="/logo.svg" alt="PartyLayer" height={28} />
              </a>
              <div>
                <h1 className="brand-title">Tokenization</h1>
                <div className="brand-sub">CIP-0056 vertical example</div>
              </div>
            </div>

            <div className="topbar-controls">
              <div className="party-switch" role="group" aria-label="demo party">
                <span className="party-switch-label">demo party</span>
                {PARTY_ORDER.map((p) => (
                  <button
                    key={p}
                    className={'party-chip' + (party === p ? ' party-chip-on' : '')}
                    onClick={() => setParty(p)}
                  >
                    {label(p)}
                  </button>
                ))}
              </div>

              <SynchronizerSwitcher
                networkId={synchronizer}
                options={SYNCHRONIZERS}
                onSwitch={setSynchronizer}
              />

              <button
                className="btn btn-ghost"
                onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              >
                {mode === 'dark' ? 'Light' : 'Dark'}
              </button>

              <ConnectButton />
            </div>
          </header>

          <p className="page-intro">
            A live demo of the Canton Network Token Standard (CIP-0056): holdings, transfers, and
            allocations, built with PartyLayer React hooks.
          </p>

          <RetryBanner />

          <p className="acting-line">
            Acting as <strong>{PARTIES[party].label}</strong>{' '}
            <CopyId value={PARTIES[party].partyId} />. Every section below reads and acts as this party.
          </p>

          <main className="grid" id="main" tabIndex={-1}>
            <Holdings />
            <Transfer />
            <Incoming />
            <Issuer />
            <Allocations />
          </main>

          <footer className="footer">
            <p className="footer-note">
              Demo backend, in-memory fixtures. Model 2: the dApp supplies every read and submit.
              See the README for real-mode wiring against a live validator and registry.
            </p>
            <div className="footer-links">
              <a href="https://partylayer.xyz" target="_blank" rel="noopener">Built with PartyLayer</a>
              <a
                href="https://github.com/PartyLayer/react-tokenization-template"
                target="_blank"
                rel="noopener"
              >
                GitHub template
              </a>
              <a href="https://partylayer.xyz/docs" target="_blank" rel="noopener">Docs</a>
              <a
                href="https://github.com/PartyLayer/PartyLayer/blob/main/LICENSE"
                target="_blank"
                rel="noopener"
              >
                MIT License
              </a>
              <span>Scaffold your own: npm create partylayer-app</span>
            </div>
          </footer>
        </div>
      </DemoProvider>
    </PartyLayerKit>
  );
}
