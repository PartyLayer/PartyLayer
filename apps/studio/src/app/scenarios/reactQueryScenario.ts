// S8.7 — React Query + DevTools scenario (the M1 "React Query DevTools"
// acceptance item) via the same `scenario` prop. connectScenario.ts +
// mockWallet.ts stay BYTE-UNCHANGED (a5d9c35f / 3c79b729). Studio-only.
//
// The PartyLayer SDK does NOT depend on @tanstack/react-query (verified: not in
// @partylayer/react's deps, no useQuery/QueryClient in the hooks — the provider
// uses useState + the SessionStore). Per the wagmi pattern (wagmi also doesn't
// impose React Query — the APP layers it on and embeds the DevTools), this
// scenario shows the integration at the app level: wrap PartyLayer in a
// QueryClientProvider, model the session as a useQuery and connect/sign as
// useMutation (genuine calls against the injected mock), invalidate the session
// query on success, and embed <ReactQueryDevtools> so the live query + mutation
// cache is inspectable. The SDK is untouched.
//
// Hidden setup reuses connect's pattern verbatim (its adapter already does
// connect + signMessage); the shared mock module (./mockWallet) is imported, not
// duplicated, so it stays byte-identical.
import { MOCK_WALLET } from './mockWallet';

/** VISIBLE example — PartyLayer + React Query + embedded DevTools. */
const REACT_QUERY_APP_CODE = `import { useMemo, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createPartyLayer } from '@partylayer/sdk';
import {
  PartyLayerProvider,
  usePartyLayer,
  useWallets,
  useConnect,
  useSignMessage,
} from '@partylayer/react';
import { studioClientOptions } from './studio-setup';

// PartyLayer ships NO React Query dependency. This is the app-level integration
// (the wagmi pattern): the session is a query, connect/sign are mutations, and
// the DevTools panel makes the cache + invalidations observable.
function Demo() {
  const client = usePartyLayer();
  const { wallets } = useWallets();
  const { connect } = useConnect();
  const { signMessage } = useSignMessage();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState('Hello from React Query');

  // The active session, modeled as a query. getActiveSession() is async →
  // a natural queryFn.
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: () => client.getActiveSession(),
  });

  // Connect, modeled as a mutation; invalidate the session query on success so
  // it refetches and the DevTools shows the cache update.
  const connectMutation = useMutation({
    mutationFn: async () => {
      const w = wallets[0];
      return connect(w ? { walletId: w.walletId } : undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session'] }),
  });

  // Sign, modeled as a mutation. Invalidating the session query here is mostly
  // illustrative (it shows the DevTools refetch after a mutation).
  const signMutation = useMutation({
    mutationFn: (msg: string) => signMessage({ message: msg }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session'] }),
  });

  const session = sessionQuery.data;
  const partyId = session ? String(session.partyId) : null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.6 }}>
      <h2 style={{ margin: '0 0 4px' }}>React Query + DevTools</h2>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
        PartyLayer has no React Query dependency — this is the app-level integration. Open the
        DevTools panel (bottom corner) to inspect the <code>['session']</code> query and the
        connect / sign mutations.
      </p>

      <p style={{ margin: '0 0 12px' }}>
        session query:{' '}
        <code style={{ background: '#f1f1f4', padding: '2px 8px', borderRadius: 6 }}>
          {sessionQuery.isFetching ? 'fetching…' : sessionQuery.status}
        </code>
        {partyId && (
          <>
            {'  '}party:{' '}
            <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 6 }}>{partyId}</code>
          </>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => connectMutation.mutate()}
          disabled={connectMutation.isPending || !!partyId}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          {connectMutation.isPending ? 'Connecting…' : partyId ? 'Connected' : 'Connect (mutation)'}
        </button>

        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message to sign"
          style={{ padding: '8px 10px', fontSize: 14, minWidth: 220, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <button
          onClick={() => signMutation.mutate(message)}
          disabled={signMutation.isPending || !partyId}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          {signMutation.isPending ? 'Signing…' : 'Sign (mutation)'}
        </button>
      </div>

      <pre style={{ marginTop: 16, padding: 12, background: '#1e1e1e', color: '#0f0', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
        {[
          'session query  : ' + sessionQuery.status + (sessionQuery.isFetching ? ' (fetching)' : ''),
          'connect mutation: ' + connectMutation.status,
          'sign mutation   : ' + signMutation.status,
          signMutation.data ? 'signature       : ' + String(signMutation.data.signature) : '',
        ].filter(Boolean).join('\\n')}
      </pre>

      {(connectMutation.error || signMutation.error) && (
        <pre style={{ marginTop: 8, padding: 12, background: '#2a0000', color: '#f88', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
          {connectMutation.error ? 'connect error: ' + connectMutation.error.message : ''}
          {signMutation.error ? 'sign error: ' + signMutation.error.message : ''}
        </pre>
      )}
    </div>
  );
}

export default function App() {
  const client = useMemo(() => createPartyLayer(studioClientOptions), []);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerProvider client={client}>
        <Demo />
      </PartyLayerProvider>
      {/* DevTools inside QueryClientProvider (the TanStack/wagmi pattern). */}
      <ReactQueryDevtools initialIsOpen={true} />
    </QueryClientProvider>
  );
}
`;

// HIDDEN sandbox wiring — connect's setup verbatim (its adapter already does
// connect + signMessage, which is all this scenario exercises). No capability added.
const STUDIO_SETUP_CODE = `// Sandbox-only wiring (hidden). One fixture adapter, SEEDED read-only storage
// (empty registry, cache-first → no network fetch / CORS preflight), announce
// discovery off → the picker lists exactly the fixture.
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

// Seeded read-only storage: a pre-built CachedRegistry wrapping an EMPTY registry
// for 'registry_stable' → getRegistry serves it CACHE-FIRST (no network fetch /
// CORS preflight). getWalletEntry('canton-demo') finds no entry →
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
      return JSON.stringify({
        registry: SEED_EMPTY_REGISTRY,
        verified: true,
        fetchedAt: Date.now(),
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
  registryUrl: '/studio-registry',
  storage: seededStorage,
  discovery: { announce: false },
};
`;

// HIDDEN entry — same mock-first entry as the connect scenario.
const STUDIO_ENTRY_CODE = `import './studio-mock-inject';
import { MOCK_CONFIG } from './studio-mock-config';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import App from './App';

// Mock driver: apply the driver config (failure scenario + connect delay) to the
// injected mock's connect — by WRAPPING window.canton.demoWallet.request, so the
// proven bd10bfa2 mock IIFE stays byte-verbatim. Only 'connect' is intercepted.
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
    e.name = name;
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

const MOCK_CONFIG_CODE = `export const MOCK_CONFIG: { failConnect: string | null; connectDelayMs: number } = {
  failConnect: null,
  connectDelayMs: 0,
};
`;

const STUDIO_MOCK_INJECT_CODE = MOCK_WALLET;

/** Scenario passed to Sandpack: visible React-Query App + hidden setup + entry + mock. */
export const reactQueryScenario = {
  title: 'React Query + DevTools',
  files: {
    '/App.tsx': { code: REACT_QUERY_APP_CODE, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/index.tsx': { code: STUDIO_ENTRY_CODE, hidden: true },
    '/studio-mock-inject.ts': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
    '/studio-mock-config.ts': { code: MOCK_CONFIG_CODE, hidden: true },
  },
  dependencies: {
    '@partylayer/react': '0.9.4',
    '@partylayer/sdk': '0.13.2',
    '@partylayer/core': '0.9.0',
    '@tanstack/react-query': '^5.0.0',
    '@tanstack/react-query-devtools': '^5.0.0',
  },
} as const;
