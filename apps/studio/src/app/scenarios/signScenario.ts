// S8.6 — sign-a-message scenario via the same `scenario` prop (fills the last
// 'soon' rail item). connectScenario.ts + mockWallet.ts stay BYTE-UNCHANGED
// (a5d9c35f / 3c79b729); this file only ADDS a scenario.
//
// UNLIKE submitScenario, NO capability is added: the connect scenario's adapter
// ALREADY implements signMessage (DEMO_CAPABILITIES includes 'signMessage'), so
// this scenario's hidden ./studio-setup is the SAME adapter as connect — used
// as-is. The VISIBLE App uses the genuine useSignMessage() hook: client.signMessage
// → adapter.signMessage → provider.request({method:'signMessage'}), which the mock
// answers with a '0xdemo_sig_…' signature string (verbatim bd10bfa2 — no change).
//
// As with the other scenarios, the shared mock module (./mockWallet) is imported,
// not duplicated; the hidden files are this scenario's own copies so connect's
// constants — and its hash — are never touched.
import { MOCK_WALLET } from './mockWallet';

/** VISIBLE example — connect, then sign a message with the genuine useSignMessage() hook. */
const SIGN_APP_CODE = `import { useMemo, useState } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import {
  PartyLayerProvider,
  useWallets,
  useConnect,
  useSignMessage,
} from '@partylayer/react';
// As with the connect example, this studio sandbox builds the client directly so
// it can run ONE fixture wallet in isolation (no live registry, no persistent
// cache — see ./studio-setup). A real app uses <PartyLayerKit network appName>.
import { studioClientOptions } from './studio-setup';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting } = useConnect();
  const { signMessage, isSigning, error } = useSignMessage();

  const [partyId, setPartyId] = useState<string | null>(null);
  const [message, setMessage] = useState('Hello from PartyLayer Studio');
  const [signed, setSigned] = useState<any | null>(null);

  async function onConnect(walletId: string) {
    const session = await connect({ walletId });
    if (session) setPartyId(String(session.partyId));
  }

  async function onSign() {
    setSigned(null);
    const result = await signMessage({ message });
    setSigned(result); // SignedMessage | null (null → see error below)
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, lineHeight: 1.6 }}>
      <style>{".pl-btn{font:inherit;font-size:14px;font-weight:600;color:#0B0F1A;background:#FFCC00;border:none;border-radius:10px;padding:10px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.05);cursor:pointer;transition:background .18s cubic-bezier(0.2,0.8,0.2,1),box-shadow .18s cubic-bezier(0.2,0.8,0.2,1)}.pl-btn:hover:not(:disabled){background:#E6B800;box-shadow:0 2px 4px rgba(15,23,42,0.08)}.pl-btn:disabled{opacity:.6;cursor:default}"}</style>
      <h2 style={{ margin: '0 0 12px' }}>Sign a message</h2>

      {!partyId ? (
        wallets.map((w) => (
          <button
            key={String(w.walletId)}
            onClick={() => onConnect(String(w.walletId))}
            disabled={isConnecting}
            className="pl-btn"
          >
            {isConnecting ? 'Connecting…' : 'Connect ' + w.name}
          </button>
        ))
      ) : (
        <>
          <p style={{ margin: '0 0 12px' }}>
            Connected — partyId:{' '}
            <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>
              {partyId}
            </code>
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message to sign"
              style={{ padding: '8px 10px', fontSize: 14, minWidth: 280, border: '1px solid #d1d5db', borderRadius: 6 }}
            />
            <button
              onClick={onSign}
              disabled={isSigning || !message}
              className="pl-btn"
            >
              {isSigning ? 'Signing…' : 'Sign message'}
            </button>
          </div>

          {signed && (
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <p style={{ margin: '0 0 4px' }}>
                signature:{' '}
                <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6, wordBreak: 'break-all' }}>
                  {String(signed.signature)}
                </code>
              </p>
              <p style={{ margin: '0 0 4px' }}>
                signed by:{' '}
                <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>
                  {String(signed.partyId)}
                </code>
              </p>
              <p style={{ margin: 0 }}>
                message:{' '}
                <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>{signed.message}</code>
              </p>
            </div>
          )}
        </>
      )}

      {signed && (
        <pre style={{ marginTop: 16, padding: 12, background: '#1e1e1e', color: '#0f0', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
          {'SignedMessage:\\n' + JSON.stringify(signed, null, 2)}
        </pre>
      )}
      {error && (
        <pre style={{ marginTop: 8, padding: 12, background: '#2a0000', color: '#f88', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
          useSignMessage.error: {error.name}: {error.message}
        </pre>
      )}
    </div>
  );
}

export default function App() {
  const client = useMemo(() => createPartyLayer(studioClientOptions), []);
  return (
    <PartyLayerProvider client={client}>
      <Demo />
    </PartyLayerProvider>
  );
}
`;

// HIDDEN sandbox wiring — the SAME adapter as the connect scenario (its
// DEMO_CAPABILITIES already include 'signMessage', and it already does
// provider.request({method:'signMessage'})). No capability is added. This is a
// faithful copy of connect's setup so connectScenario.ts stays byte-unchanged.
const STUDIO_SETUP_CODE = `// Sandbox-only wiring (hidden). A real dApp needs NONE of this: it uses
// <PartyLayerKit>, the built-in adapters, and the public registry. Here we build
// the client directly with: one fixture adapter; SEEDED read-only storage (empty
// registry, cache-first → no network fetch / CORS preflight); announce discovery
// off → the picker lists exactly the fixture. The adapter ALREADY implements
// signMessage, which is all this scenario needs.
import {
  toPartyId,
  toSignature,
  toWalletId,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type PersistedSession,
  type Session,
  type SignMessageParams,
  type SignedMessage,
  type StorageAdapter,
  type WalletAdapter,
} from '@partylayer/core';

const WALLET_ID = 'canton-demo';
const WALLET_NAME = 'Canton Demo Wallet';
const DEMO_CAPABILITIES: CapabilityKey[] = ['connect', 'disconnect', 'restore', 'signMessage', 'injected'];

interface DemoProvider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

function readProvider(): DemoProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { canton?: { demoWallet?: DemoProvider } };
  const demo = w.canton?.demoWallet;
  if (!demo || typeof demo.request !== 'function') return null;
  return demo;
}

export class CantonDemoWalletAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = WALLET_NAME;

  getCapabilities(): CapabilityKey[] {
    return DEMO_CAPABILITIES;
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') return { installed: false, reason: 'Browser environment required' };
    if (!readProvider()) return { installed: false, reason: 'Canton Demo Wallet fixture not present' };
    return { installed: true, reason: 'Canton Demo Wallet fixture detected' };
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    const provider = readProvider();
    if (!provider) throw new Error('Canton Demo Wallet fixture not available');
    const status = (await provider.request({ method: 'connect' })) as { isConnected: boolean };
    if (!status.isConnected) throw new Error('Canton Demo Wallet refused connect');
    const account = (await provider.request({ method: 'getPrimaryAccount' })) as {
      partyId: string;
      address: string;
      namespace: string;
    };
    return {
      partyId: toPartyId(account.partyId),
      session: {
        walletId: this.walletId,
        network: ctx.network,
        createdAt: Date.now(),
        metadata: { address: account.address, namespace: account.namespace, fixture: 'mock' },
      },
      capabilities: this.getCapabilities(),
    };
  }

  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    const provider = readProvider();
    if (provider) await provider.request({ method: 'disconnect' });
  }

  async restore(_ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    const provider = readProvider();
    if (!provider) return null;
    const status = (await provider.request({ method: 'status' })) as {
      session: { isConnected: boolean } | null;
    };
    if (!status.session?.isConnected) return null;
    const account = (await provider.request({ method: 'getPrimaryAccount' })) as {
      partyId: string;
      address: string;
      namespace: string;
    };
    if (account.partyId !== persisted.partyId) return null;
    return {
      ...persisted,
      walletId: this.walletId,
      metadata: { ...(persisted.metadata ?? {}), address: account.address, namespace: account.namespace, fixture: 'mock' },
    };
  }

  async signMessage(_ctx: AdapterContext, session: Session, params: SignMessageParams): Promise<SignedMessage> {
    const provider = readProvider();
    if (!provider) throw new Error('Canton Demo Wallet fixture not available');
    const signature = (await provider.request({
      method: 'signMessage',
      params: { message: params.message },
    })) as string;
    return {
      signature: toSignature(signature),
      partyId: session.partyId,
      message: params.message,
      nonce: params.nonce,
      domain: params.domain,
    };
  }
}

// Seeded read-only storage: returns a pre-built CachedRegistry wrapping an EMPTY
// registry for 'registry_stable'. loadFromStorage seeds memoryCache at ctor, so
// getRegistry serves it CACHE-FIRST and never does a network fetch — avoiding the
// CORS preflight the If-None-Match header triggers on cross-origin hosts (the
// real connect-blocker). getWalletEntry('canton-demo') then finds no entry →
// WalletNotFoundError, which connect's origin-allowlist check swallows.
const SEED_EMPTY_REGISTRY = {
  metadata: {
    registryVersion: '1.0.0',
    schemaVersion: '1.0.0',
    publishedAt: '2026-06-16T00:00:00Z',
    channel: 'stable',
    sequence: 0,
  },
  wallets: [],
};
const seededStorage: StorageAdapter = {
  get: async (key: string) => {
    if (key === 'registry_stable') {
      // CachedRegistry shape (status.ts): { registry, verified, fetchedAt, etag?, sequence }
      return JSON.stringify({
        registry: SEED_EMPTY_REGISTRY,
        verified: true,
        fetchedAt: Date.now(), // fresh → age < cacheTtl (1h) → getRegistry returns cache, no sync fetch
        etag: 'studio-seed',
        sequence: 0,
      });
    }
    return null;
  },
  set: async () => {},
  remove: async () => {},
  clear: async () => {},
};

export const studioClientOptions = {
  network: 'devnet',
  app: { name: 'PartyLayer Studio' },
  adapters: [new CantonDemoWalletAdapter()],
  // Harmless placeholder: getRegistry serves the seeded cache before any fetch, so
  // this URL is only touched by the fire-and-forget background refresh (whose
  // failure is internal to the registry-client and never reaches connect).
  registryUrl: '/studio-registry',
  storage: seededStorage,
  // Off → no canton:announceProvider discovery + no window.canton namespace scan,
  // so the mock's window.canton.demoWallet slot can't synthesize a phantom entry.
  discovery: { announce: false },
};
`;

// HIDDEN entry — same mock-first entry as the connect scenario: a side-effect
// import of the mock module runs (and sets window.canton.demoWallet) BEFORE React
// mounts, in the SAME bundled module graph. The connect-driver wrapper is kept
// verbatim so the shared MockDriverPanel still drives the connect step; only
// 'connect' is intercepted, so signMessage passes straight through to the mock.
const STUDIO_ENTRY_CODE = `import './studio-mock-inject';
import { MOCK_CONFIG } from './studio-mock-config';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import App from './App';

// Mock driver: apply the driver config (failure scenario + connect delay) to the
// injected mock's connect — by WRAPPING window.canton.demoWallet.request, so the
// proven bd10bfa2 mock IIFE stays byte-verbatim. Only 'connect' is intercepted;
// 'signMessage' passes straight through to the mock.
(function applyMockDriver() {
  const demo = (window as any).canton && (window as any).canton.demoWallet;
  if (!demo || typeof demo.request !== 'function') return;
  const orig = demo.request.bind(demo);
  const mapFail = (name) => {
    const msgs = {
      userRejected: 'User rejected the connection request (4001)',
      insufficientTraffic: 'Insufficient traffic to complete the request',
      synchronizerError: 'Synchronizer unavailable — chain disconnected (4901)',
      transactionTimeout: 'Wallet did not respond in time (timeout)',
      genericError: 'Wallet connection failed',
    };
    const e = new Error(msgs[name] || ('Mock failure: ' + name));
    e.name = name; // surfaces as the scenario name in the connect diagnostics
    return e;
  };
  demo.request = (args) => {
    if (args && args.method === 'connect') {
      const cfg = MOCK_CONFIG || {};
      const run = () => (cfg.failConnect ? Promise.reject(mapFail(cfg.failConnect)) : orig(args));
      if (cfg.connectDelayMs) {
        return new Promise((resolve, reject) => {
          setTimeout(() => run().then(resolve, reject), cfg.connectDelayMs);
        });
      }
      return run();
    }
    return orig(args);
  };
})();

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

// HIDDEN driver config — read by the entry wrapper. Default = success behavior.
const MOCK_CONFIG_CODE = `export const MOCK_CONFIG: { failConnect: string | null; connectDelayMs: number } = {
  failConnect: null,
  connectDelayMs: 0,
};
`;

// HIDDEN mock module — the SHARED VERBATIM CIP-0103 mock (bd10bfa2), imported (not
// duplicated) from ./mockWallet so it stays byte-identical across scenarios.
const STUDIO_MOCK_INJECT_CODE = MOCK_WALLET;

/** Scenario passed to Sandpack: visible sign App + hidden setup + hidden entry (mock-first) + hidden mock module. */
export const signScenario = {
  title: 'Sign a message',
  files: {
    '/App.tsx': { code: SIGN_APP_CODE, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/index.tsx': { code: STUDIO_ENTRY_CODE, hidden: true },
    '/studio-mock-inject.ts': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
    '/studio-mock-config.ts': { code: MOCK_CONFIG_CODE, hidden: true },
  },
  dependencies: {
    '@partylayer/react': '0.9.4',
    '@partylayer/sdk': '0.13.2',
    '@partylayer/core': '0.9.0',
  },
} as const;
