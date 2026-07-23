/**
 * The Tokenization vertical example shell.
 *
 * PartyLayerKit provides the session + theme context (mirroring the react-vite
 * template's setup), themed with the `teal` trading family and a light/dark toggle.
 * The header carries the connect UI and a DEMO-PARTY switcher: switching the demo
 * party changes whose data every section reads and who acts. It is app state,
 * separate from the wallet session.
 */
import { useState } from 'react';
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
import { PARTIES, PARTY_ORDER } from './lib/fixtures';
import type { DemoPartyKey } from './lib/types';
import { Holdings } from './sections/Holdings';
import { Transfer } from './sections/Transfer';
import { Incoming } from './sections/Incoming';
import { Issuer } from './sections/Issuer';
import { Allocations } from './sections/Allocations';
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
  const [party, setParty] = useState<DemoPartyKey>('alice');
  const [synchronizer, setSynchronizer] = useState('canton:da-devnet');

  const theme = mode === 'dark' ? themes.teal.dark : themes.teal.light;

  return (
    <PartyLayerKit network="devnet" appName="PartyLayer Tokenization" theme={theme} adapters={ADAPTERS}>
      <DemoProvider value={{ party, setParty, backend: demoBackend, mode }}>
        <div className={'app app-' + mode}>
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true" />
              <div>
                <div className="brand-title">Tokenization</div>
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
                    {PARTIES[p].label}
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
            <code>{PARTIES[party].partyId}</code>. Every section below reads and acts as this party.
          </p>

          <main className="grid">
            <Holdings />
            <Transfer />
            <Incoming />
            <Issuer />
            <Allocations />
          </main>

          <footer className="footer">
            Demo backend, in-memory fixtures. Model 2: the dApp supplies every read and submit.
            See the README for real-mode wiring against a live validator and registry.
          </footer>
        </div>
      </DemoProvider>
    </PartyLayerKit>
  );
}
