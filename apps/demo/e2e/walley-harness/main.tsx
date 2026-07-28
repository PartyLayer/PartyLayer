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
import { PartyLayerKit, ConnectButton, useAccount, usePartyLayer } from '@partylayer/react';
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

/**
 * Issues a REAL CIP-0103 request through the client's provider on click. This is the
 * step the reload assertion was missing. It uses `signMessage`, NOT a read: the bridge
 * answers reads (listAccounts, status, ...) from the session snapshot, which survives
 * reload regardless of the fix, so a read cannot distinguish the bug. `signMessage`
 * routes to the (restored) provider, exactly as the shipped discovery-restore unit test
 * does. The bug threw "Not connected" here before any popup; the fix reaches Walley's
 * approval popup instead. We do not complete the approval, because reaching the wallet
 * (rather than throwing) is the proof. Result is written to a testid as
 * "ok:signed" / "pending" / "error:<message>" (never a credential).
 */
function PostReloadRequest() {
  const client = usePartyLayer();
  const [result, setResult] = React.useState('idle');
  const run = async () => {
    setResult('pending');
    try {
      const sig = await client
        .asProvider()
        .request<{ signature?: string }>({ method: 'signMessage', params: { message: 'reload-proof' } });
      setResult(`ok:${sig && sig.signature ? 'signed' : 'y'}`);
    } catch (e) {
      setResult(`error:${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <div>
      <button data-testid="do-request" onClick={run}>
        request
      </button>
      <div data-testid="request-result">{result}</div>
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
      <PostReloadRequest />
    </PartyLayerKit>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
