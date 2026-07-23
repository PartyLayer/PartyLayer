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
import { DemoProvider } from './context/DemoContext';
import { demoBackend } from './lib/backend';
import { createLiveBackend, fetchGatewayParties } from './lib/liveBackend';
import { PARTIES, PARTY_ORDER } from './lib/fixtures';
import type { DemoPartyKey } from './lib/types';
import { Trades } from './sections/Trades';
import { MyAllocations } from './sections/MyAllocations';
import { Holdings } from './sections/Holdings';
import './App.css';

// The dev wallet adapter apps/demo uses, so the connect surface works in a demo
// context. The demo-party switcher, not this connection, drives the section data.
const ADAPTERS = [new ConsoleAdapter()];

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
              <span className="brand-mark" aria-hidden="true" />
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
            Demo backend, in-memory fixtures. Model 2: the dApp supplies every read and submit.
            See the README for the atomic settle semantics and real-mode wiring.
          </footer>
        </div>
      </DemoProvider>
    </PartyLayerKit>
  );
}
