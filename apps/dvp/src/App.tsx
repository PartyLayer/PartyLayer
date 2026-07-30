/**
 * The DvP vertical example shell.
 *
 * PartyLayerKit provides the session + theme context (mirroring the react-vite
 * template's setup), themed with the `gold` family and a light/dark toggle. The
 * header carries the connect UI and a DEMO-PARTY switcher: switching the demo party
 * changes whose data every section reads and who acts (venue vs counterparty). It
 * is app state, separate from the wallet session.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  PartyLayerKit,
  ConnectButton,
  SynchronizerSwitcher,
  themes,
  type SynchronizerOption,
} from '@partylayer/react';
import { ConsoleAdapter } from '@partylayer/adapter-console';
import { SendAdapter } from '@partylayer/adapter-send';
import { LoopAdapter } from '@partylayer/adapter-loop';
import { Cantor8Adapter } from '@partylayer/adapter-cantor8';
import { NightlyAdapter } from '@partylayer/adapter-nightly';
import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import { BronAdapter } from '@partylayer/adapter-bron';
// Walley is the stable registry's discovery-adapter (Path B) wallet. Pinned exactly
// because this is a third-party runtime dependency shipped on a public demo page.
import { WalleyAdapter } from '@k2flabs/walley-dapp-sdk';
import { DemoProvider } from './context/DemoContext';
import { demoBackend } from './lib/backend';
import { createLiveBackend, fetchGatewayParties } from './lib/liveBackend';
import { PARTIES, PARTY_ORDER } from './lib/fixtures';
import type { DemoPartyKey } from './lib/types';
import { Trades } from './sections/Trades';
import { MyAllocations } from './sections/MyAllocations';
import { Holdings } from './sections/Holdings';
import './App.css';

// Every stable wallet gets its adapter so the connect surface can genuinely
// connect each one, not merely list it. The SDK hides any wallet whose adapter is
// absent (a click could only fail), so registering all of them is what makes the
// picker complete. Console and Send are announce-native (installing the extension
// is enough), but their adapters are registered too so a direct connect works
// without relying on the announce event. Walley is bridged from its official
// ProviderAdapter; the devnet host matches the registry entry's networkHosts.devnet.
// The demo-party switcher, not this connection, drives the section data; the app is
// fixed to devnet (see network="devnet" below).
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
function makeBronAdapter(): BronAdapter | null {
  const env = import.meta.env;
  const authorizationUrl = env.VITE_BRON_AUTHORIZATION_URL as string | undefined;
  const tokenUrl = env.VITE_BRON_TOKEN_URL as string | undefined;
  const clientId = env.VITE_BRON_CLIENT_ID as string | undefined;
  const redirectUri = env.VITE_BRON_REDIRECT_URI as string | undefined;
  const baseUrl = env.VITE_BRON_API_URL as string | undefined;
  if (!authorizationUrl || !tokenUrl || !clientId || !redirectUri || !baseUrl) return null;
  return new BronAdapter({
    auth: { authorizationUrl, tokenUrl, clientId, redirectUri, usePKCE: true },
    api: { baseUrl },
  });
}

const BRON_ADAPTER = makeBronAdapter();

const ADAPTERS = [
  new ConsoleAdapter(),
  new SendAdapter(),
  new LoopAdapter(),
  new Cantor8Adapter(),
  new NightlyAdapter(),
  new WalleyAdapter({ host: 'https://dev.walley.cc' }),
  new WalletConnectAdapter({ projectId: WC_PROJECT_ID }),
  ...(BRON_ADAPTER ? [BRON_ADAPTER] : []),
];

const SYNCHRONIZERS: SynchronizerOption[] = [
  { networkId: 'canton:da-devnet', label: 'DevNet' },
  { networkId: 'canton:da-testnet', label: 'TestNet' },
];

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [party, setParty] = useState<DemoPartyKey>('venue');
  const [synchronizer, setSynchronizer] = useState('canton:da-devnet');

  // Backend selection: demo (default, unchanged) or live (the DevNet gateway). The
  // browser never holds a ledger credential; live routes every read and submit to the
  // gateway at VITE_GATEWAY_URL, and the venue actions map to the gateway trade endpoints.
  const isLive = import.meta.env.VITE_BACKEND === 'live';
  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || '';
  const backend = useMemo(() => (isLive ? createLiveBackend(gatewayUrl) : demoBackend), [isLive, gatewayUrl]);
  const [gatewayLabels, setGatewayLabels] = useState<Partial<Record<DemoPartyKey, string>>>({});
  useEffect(() => {
    if (isLive && gatewayUrl) fetchGatewayParties(gatewayUrl).then(setGatewayLabels);
  }, [isLive, gatewayUrl]);
  const label = (p: DemoPartyKey) => gatewayLabels[p] ?? PARTIES[p].label;

  const theme = mode === 'dark' ? themes.gold.dark : themes.gold.light;

  return (
    <PartyLayerKit network="devnet" appName="PartyLayer DvP" theme={theme} adapters={ADAPTERS}>
      <DemoProvider value={{ party, setParty, backend, mode }}>
        <div className={'app app-' + mode}>
          <header className="topbar">
            <div className="brand">
              <a className="brand-logo" href="https://partylayer.xyz" target="_blank" rel="noopener">
                <img src="/logo.svg" alt="PartyLayer" height={28} />
              </a>
              <div>
                <div className="brand-title">DvP</div>
                <div className="brand-sub">delivery versus payment, CIP-0056 allocations</div>
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

          <p className="acting-line">
            Acting as <strong>{PARTIES[party].label}</strong>{' '}
            <code>{PARTIES[party].partyId}</code>.{' '}
            {party === 'venue'
              ? 'The venue creates trades and settles atomically once both legs are allocated.'
              : 'Allocate your leg of a trade, or reject it.'}
          </p>

          <main className="grid">
            <Trades />
            <MyAllocations />
            <Holdings />
          </main>

          <footer className="footer">
            <p className="footer-note">
              Demo backend, in-memory fixtures. Model 2: the dApp supplies every read and submit.
              See the README for the atomic settle semantics and real-mode wiring.
            </p>
            <div className="footer-links">
              <a href="https://partylayer.xyz" target="_blank" rel="noopener">Built with PartyLayer</a>
              <a
                href="https://github.com/PartyLayer/react-dvp-template"
                target="_blank"
                rel="noopener"
              >
                GitHub template
              </a>
              <a href="https://partylayer.xyz/docs" target="_blank" rel="noopener">Docs</a>
              <span>Scaffold your own: npm create partylayer-app</span>
            </div>
          </footer>
        </div>
      </DemoProvider>
    </PartyLayerKit>
  );
}
