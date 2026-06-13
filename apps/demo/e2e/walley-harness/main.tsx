/**
 * TEST-ONLY Walley E2E harness entry.
 *
 * Mounts the real `PartyLayerKit` with the Walley OfficialProviderAdapter pointed
 * at devnet (`dev.walley.cc`). Built + served ONLY by the Playwright walley
 * webServer (esbuild) — NEVER part of the prod Next bundle and NEVER wired into
 * the live demo config (hard hold). STEP-3 wires the live demo separately.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PartyLayerKit, ConnectButton, useAccount } from '@partylayer/react';
import { WalleyAdapter } from '@k2flabs/walley-dapp-sdk';

/**
 * Renders the @partylayer/session store status (`useAccount`) so the E2E can
 * OBSERVE the restore result post-reload (the contested step) without poking
 * provider internals. `status` reflects OUR envelope-driven restore.
 */
function SessionStatus() {
  const { status, party } = useAccount();
  return (
    <div data-testid="session-status" data-party={party ?? ''}>
      {status}
    </div>
  );
}

function App() {
  return (
    <PartyLayerKit
      network="devnet"
      appName="Walley E2E"
      // FACTORY form: no hardcoded host. The SDK resolves it from the registry
      // entry's adapter.networkHosts[devnet] and constructs the official adapter.
      // registryUrl points at the harness-served BRANCH registry (serve.mjs), so
      // this proves end-to-end host-resolution-from-a-registry-entry against the
      // branch's own data — independent of the production CDN deploy.
      registryUrl="/registry"
      adapters={[{ providerId: 'walley', create: (host: string) => new WalleyAdapter({ host }) }]}
    >
      <ConnectButton />
      <SessionStatus />
    </PartyLayerKit>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
