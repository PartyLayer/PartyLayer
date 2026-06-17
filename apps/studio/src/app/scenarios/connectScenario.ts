// S8.2 — connect-only scenario via the CIP-0103 mock wallet.
// Hybrid layout (Option C): the VISIBLE /App.tsx is a clean teaching example;
// the sandbox wiring lives in a HIDDEN /studio-setup.ts; the mock JS is inlined
// in /public/index.html (no served-path dependency). Runs published @partylayer/*
// via Sandpack's bundler.
//
// S8.2-fix-2: use the LOWER-LEVEL createPartyLayer + PartyLayerProvider form
// (instead of PartyLayerKit's auto-client) so the sandbox controls storage. A
// no-op storage means NO persistent registry cache, so the 404 registry URL
// yields an EMPTY registry (no cache fallback) → the picker lists ONLY the
// fixture wallet, and connect → the (sole) demo adapter → partyId. Mirrors
// wagmi's mock-connector-at-config-level approach.
import { MOCK_WALLET } from './mockWallet';

/** VISIBLE, read-only example — clean, instructive lower-level usage. */
export const CONNECT_APP_CODE = `import { useMemo, useState } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import { PartyLayerProvider, useWallets, useConnect } from '@partylayer/react';
// A normal app uses <PartyLayerKit network appName> which builds the client for
// you. This studio sandbox builds the client directly so it can run ONE fixture
// wallet in isolation — no live registry, no persistent cache (see ./studio-setup).
import { studioClientOptions } from './studio-setup';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting } = useConnect();
  const [partyId, setPartyId] = useState<string | null>(null);

  async function onConnect(walletId: string) {
    const session = await connect({ walletId });
    if (session) setPartyId(String(session.partyId));
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.6 }}>
      <h2 style={{ margin: '0 0 12px' }}>Connect a wallet</h2>

      {partyId ? (
        <p>
          ✅ Connected — partyId:{' '}
          <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>
            {partyId}
          </code>
        </p>
      ) : (
        wallets.map((w) => (
          <button
            key={String(w.walletId)}
            onClick={() => onConnect(String(w.walletId))}
            disabled={isConnecting}
            style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
          >
            {isConnecting ? 'Connecting…' : 'Connect ' + w.name}
          </button>
        ))
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

/** HIDDEN sandbox wiring — fixture adapter + no-cache, no-live-registry client options. */
const STUDIO_SETUP_CODE = `// Sandbox-only wiring (hidden). A real dApp needs NONE of this: it uses
// <PartyLayerKit>, the built-in adapters, and the public registry. Here we build
// the client directly with: one fixture adapter; a NO-OP storage (so there is no
// persistent registry cache); and a local 404 registry URL (so the registry
// fetch fails → adapters-only discovery → the picker lists exactly the fixture).
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

// No-op storage → NO persistent registry cache. Combined with the 404 registry
// URL below, the registry fetch fails with nothing to fall back to, so
// listWallets surfaces only the registered adapter(s) — exactly the fixture.
const noopStorage: StorageAdapter = {
  get: async () => null,
  set: async () => {},
  remove: async () => {},
  clear: async () => {},
};

export const studioClientOptions = {
  network: 'devnet',
  app: { name: 'PartyLayer Studio' },
  adapters: [new CantonDemoWalletAdapter()],
  // Local path with no registry file → 404 → adapters-only (no cache to fall back to).
  registryUrl: '/studio-sandbox-no-registry',
  storage: noopStorage,
  // Off → no canton:announceProvider discovery + no window.canton namespace scan,
  // so the mock's window.canton.demoWallet slot can't synthesize a phantom 2nd
  // entry. listWallets then surfaces exactly the one registered adapter.
  discovery: { announce: false },
};
`;

/** HIDDEN Sandpack HTML — mock INLINED (no served path) so it runs before mount. */
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>PartyLayer Studio — Connect</title>
    <!-- CIP-0103 mock wallet, inlined so it runs before React mounts → window.canton.demoWallet -->
    <script>
${MOCK_WALLET}
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/** Scenario passed to Sandpack: visible App + hidden setup + hidden inlined-mock HTML. */
export const connectScenario = {
  title: 'Connect a wallet',
  files: {
    '/App.tsx': { code: CONNECT_APP_CODE, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/public/index.html': { code: INDEX_HTML, hidden: true },
  },
  dependencies: {
    '@partylayer/react': '0.9.4',
    '@partylayer/sdk': '0.13.2',
    '@partylayer/core': '0.9.0',
  },
} as const;
