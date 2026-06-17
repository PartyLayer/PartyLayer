// S8.2 — the first runnable scenario: connect-only, via the CIP-0103 mock wallet.
// Hybrid layout (Option C): the VISIBLE /App.tsx is a clean teaching example
// (PartyLayerKit + hooks); the fixture wiring (a demo adapter + a local empty
// registry) lives in a HIDDEN /studio-setup.ts; the mock JS is inlined directly
// in /public/index.html's <script> (no served-path dependency) so
// window.canton.demoWallet exists before React mounts. Runs published
// @partylayer/* via Sandpack's bundler.
import { MOCK_WALLET } from './mockWallet';

/** VISIBLE, read-only example — what a real dApp writes (clean hooks usage). */
export const CONNECT_APP_CODE = `import { useState } from 'react';
import { PartyLayerKit, useWallets, useConnect } from '@partylayer/react';
// Studio runs one fixture wallet in a sandbox, so the adapter list and a local
// (empty) registry come from ./studio-setup. A real dApp passes neither — it
// uses PartyLayer's built-in adapters + the public registry.
import { studioAdapters, STUDIO_REGISTRY_URL } from './studio-setup';

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
  return (
    <PartyLayerKit
      network="devnet"
      appName="PartyLayer Studio"
      adapters={studioAdapters}
      registryUrl={STUDIO_REGISTRY_URL}
    >
      <Demo />
    </PartyLayerKit>
  );
}
`;

/** HIDDEN sandbox wiring — a fixture adapter + a local empty registry. */
const STUDIO_SETUP_CODE = `// Sandbox-only wiring (hidden). A real dApp needs NONE of this: it uses the
// built-in adapters + the public registry. Here we register one fixture adapter
// (wrapping the injected window.canton.demoWallet) and point the registry at a
// local path with no file, so the SDK's registry fetch 404s and falls back to
// adapters-only discovery → the list contains exactly the fixture wallet.
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

export const studioAdapters: WalletAdapter[] = [new CantonDemoWalletAdapter()];

// Local path with no registry file → the SDK registry fetch 404s → adapters-only
// discovery → the picker lists exactly the fixture wallet (deterministic sandbox).
export const STUDIO_REGISTRY_URL = '/studio-sandbox-no-registry';
`;

/** HIDDEN Sandpack HTML — the mock is INLINED here (no served path to get wrong). */
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
