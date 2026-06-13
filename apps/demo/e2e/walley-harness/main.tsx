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

const WALLEY_DEVNET_HOST = 'https://dev.walley.cc';

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
      // The SDK (createPartyLayer) accepts + auto-wraps an OfficialProviderAdapter
      // at runtime (GenericDiscoveryAdapter). The Kit's prop type is narrower
      // today; STEP-3 widens it for the live demo. Cast is test-harness-only.
      adapters={[new WalleyAdapter({ host: WALLEY_DEVNET_HOST })] as never}
    >
      <ConnectButton />
      <SessionStatus />
    </PartyLayerKit>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
