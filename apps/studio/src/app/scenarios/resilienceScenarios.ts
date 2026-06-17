// Session-resilience scenarios (the ≥2 session-resilience requirement) via the
// same `scenario` prop. connectScenario.ts + mockWallet.ts stay BYTE-UNCHANGED
// (a5d9c35f / 3c79b729); this file only ADDS scenarios. Studio-only. NO mock change.
//
// ── Why these two (and not the originally-sketched mock.emit ones) ───────────
// VERIFIED FROM SOURCE: useAccount()/useSession() read the @partylayer/session
// SessionStore, which subscribes to `client.asProvider()` — the bridge
// (createProviderBridge). The bridge's eventBus is fed ONLY by wireEvents() from
// the SDK CLIENT's events (session:connected / session:disconnected / tx:status);
// it synthesizes one accountsChanged at session:connected from the session's
// single party. The SDK client never subscribes to wallet/adapter events. So
// `window.canton.demoWallet.emit('statusChanged'/'accountsChanged', …)` fires the
// mock's OWN listeners, which nobody in the store chain observes — it is a no-op
// to useAccount(). Driving the resilience state machine therefore goes through
// the store's real methods, not a mock emit.
//
//   Scenario 4 — RECONNECT (rehydrate): store.restore() (useSession().restore())
//     runs restoreImpl(): setState('reconnecting') → provider.request({status})
//     (bridge → client.getActiveSession() → still connected) → setState('connected')
//     + re-list accounts. This is the genuine page-reload / rehydrate path
//     (init() calls the same restoreImpl). useAccount() visibly goes
//     connected → reconnecting → connected.
//
//   Scenario 5 — DISCONNECT IS TERMINAL (the resilience boundary): store.disconnect()
//     (useSession().disconnect()) sets explicitDisconnect → status 'disconnected'
//     and clears the live session. A subsequent restore() re-probes the wallet,
//     finds it gone (client.getActiveSession() === null), and STAYS disconnected —
//     proving an explicit disconnect is final and never auto-reconnects, in
//     contrast to scenario 4 where restore() reconnects a still-live session.
//
// (Option A "expiry → re-auth" was verified fiddly: store.ts handleExpiry never
// sets 'connected' after onReauthRequired resolves, and re-arming expiry loops —
// see resilience.test.ts SCENARIO-4, which asserts session:expired + account
// preserved but NOT a return to 'connected'. So the clean genuine pair is
// restore-reconnect + disconnect-terminal.)
//
// Both scenarios reuse connect's hidden setup VERBATIM (its adapter already does
// connect/disconnect/restore + the seeded-cache, announce:false, entry-injected
// mock); NO capability is added. The shared mock module (./mockWallet) is
// imported, not duplicated, so it stays byte-identical.
import { MOCK_WALLET } from './mockWallet';

// ── Shared hidden setup (connect's verbatim) ─────────────────────────────────
// Defined ONCE here and reused by both resilience scenarios (one new file, two
// exports). connectScenario.ts is NOT touched, so its hash is unaffected.
const STUDIO_SETUP_CODE = `// Sandbox-only wiring (hidden). One fixture adapter, SEEDED read-only storage
// (empty registry, cache-first → no network fetch / CORS preflight), announce
// discovery off. The adapter implements connect/disconnect/restore/signMessage —
// exactly what the session store's restore()/disconnect() paths exercise.
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
// registry for 'registry_stable'. getRegistry serves it CACHE-FIRST (no network
// fetch / CORS preflight). getWalletEntry('canton-demo') then finds no entry →
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

/** Shared hidden files (connect's setup verbatim) + a per-scenario visible App. */
function makeFiles(appCode: string) {
  return {
    '/App.tsx': { code: appCode, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/index.tsx': { code: STUDIO_ENTRY_CODE, hidden: true },
    '/studio-mock-inject.ts': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
    '/studio-mock-config.ts': { code: MOCK_CONFIG_CODE, hidden: true },
  };
}

const DEPENDENCIES = {
  '@partylayer/react': '0.9.4',
  '@partylayer/sdk': '0.13.2',
  '@partylayer/core': '0.9.0',
};

// ── Scenario 4 — RECONNECT (rehydrate via store.restore()) ───────────────────
const RECONNECT_APP_CODE = `import { useEffect, useMemo, useState } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import {
  PartyLayerProvider,
  useWallets,
  useConnect,
  useAccount,
  useSession,
  useAccountEffect,
} from '@partylayer/react';
import { studioClientOptions } from './studio-setup';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting } = useConnect();
  // wagmi-parity reactive account/status from the shared session store.
  const account = useAccount();
  // useSession exposes the store's actions — restore() is the genuine rehydrate
  // path (the same one init() runs on page reload).
  const session = useSession();

  const [log, setLog] = useState<string[]>([]);
  const append = (line: string) => setLog((prev) => [...prev, line]);

  // Live status transitions → log (captures connected → reconnecting → connected).
  useEffect(() => {
    append('status → ' + account.status);
  }, [account.status]);

  // wagmi-parity side-effects.
  useAccountEffect({
    onConnect: (d) => append('onConnect: ' + (d.account?.partyId ?? '(no party yet)')),
    onDisconnect: () => append('onDisconnect'),
  });

  async function onConnect(walletId: string) {
    await connect({ walletId });
  }

  async function onReconnect() {
    append('— restore() called (re-probing the live wallet) —');
    // restore() = restoreImpl: status → 'reconnecting', then provider.request
    // ({method:'status'}) (bridge → client.getActiveSession(), still connected)
    // → status → 'connected', accounts re-listed. No user re-action needed.
    await session.restore();
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.6 }}>
      <h2 style={{ margin: '0 0 4px' }}>Session resilience — reconnect</h2>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
        A transient drop / page reload re-probes the live wallet and lands back connected — automatically.
      </p>

      <p style={{ margin: '0 0 12px' }}>
        status:{' '}
        <code style={{ background: account.isConnected ? '#dcfce7' : '#f1f1f4', padding: '2px 8px', borderRadius: 6 }}>
          {account.status}
        </code>
        {account.party && (
          <>
            {'  '}party:{' '}
            <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>{account.party}</code>
          </>
        )}
      </p>

      {!account.isConnected && !account.isReconnecting ? (
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
      ) : (
        <button
          onClick={onReconnect}
          disabled={account.isReconnecting}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          {account.isReconnecting ? 'Reconnecting…' : 'Simulate reconnect (restore)'}
        </button>
      )}

      {log.length > 0 && (
        <pre style={{ marginTop: 16, padding: 12, background: '#1e1e1e', color: '#0f0', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
          {log.join('\\n')}
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

// ── Scenario 5 — DISCONNECT IS TERMINAL (the resilience boundary) ────────────
const DISCONNECT_APP_CODE = `import { useEffect, useMemo, useState } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import {
  PartyLayerProvider,
  useWallets,
  useConnect,
  useAccount,
  useSession,
  useAccountEffect,
} from '@partylayer/react';
import { studioClientOptions } from './studio-setup';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting } = useConnect();
  const account = useAccount();
  const session = useSession();

  const [log, setLog] = useState<string[]>([]);
  const append = (line: string) => setLog((prev) => [...prev, line]);

  useEffect(() => {
    append('status → ' + account.status);
  }, [account.status]);

  useAccountEffect({
    onConnect: (d) => append('onConnect: ' + (d.account?.partyId ?? '(no party yet)')),
    onDisconnect: () => append('onDisconnect'),
  });

  async function onConnect(walletId: string) {
    await connect({ walletId });
  }

  async function onDisconnect() {
    append('— disconnect() called (EXPLICIT) —');
    // Explicit disconnect sets explicitDisconnect in the store → terminal:
    // never auto-reconnects, and clears the live session.
    await session.disconnect();
  }

  async function onTryRestore() {
    append('— restore() called after an explicit disconnect —');
    // restore() re-probes via provider.request({method:'status'}) (bridge →
    // client.getActiveSession() === null after disconnect) → STAYS disconnected.
    await session.restore();
    append('restore() finished — still ' + (account.isConnected ? 'connected' : 'disconnected'));
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, lineHeight: 1.6 }}>
      <h2 style={{ margin: '0 0 4px' }}>Session resilience — disconnect is terminal</h2>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
        The flip side of resilience: an EXPLICIT disconnect is final. Unlike a transient drop,
        restore() will not revive it.
      </p>

      <p style={{ margin: '0 0 12px' }}>
        status:{' '}
        <code style={{ background: account.isConnected ? '#dcfce7' : '#f1f1f4', padding: '2px 8px', borderRadius: 6 }}>
          {account.status}
        </code>
        {account.party && (
          <>
            {'  '}party:{' '}
            <code style={{ background: '#f1f1f4', padding: '2px 6px', borderRadius: 6 }}>{account.party}</code>
          </>
        )}
      </p>

      {!account.isConnected ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {wallets.map((w) => (
            <button
              key={String(w.walletId)}
              onClick={() => onConnect(String(w.walletId))}
              disabled={isConnecting}
              style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
            >
              {isConnecting ? 'Connecting…' : 'Connect ' + w.name}
            </button>
          ))}
          {/* After an explicit disconnect, prove restore() does NOT revive it. */}
          {account.isDisconnected && log.some((l) => l.indexOf('EXPLICIT') !== -1) && (
            <button
              onClick={onTryRestore}
              style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
            >
              Attempt restore (should stay disconnected)
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onDisconnect}
          style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          Disconnect (explicit)
        </button>
      )}

      {log.length > 0 && (
        <pre style={{ marginTop: 16, padding: 12, background: '#1e1e1e', color: '#0f0', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
          {log.join('\\n')}
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

/** Scenario 4 — reconnect via the genuine store.restore() re-probe. */
export const resilienceReconnectScenario = {
  title: 'Session resilience — reconnect',
  files: makeFiles(RECONNECT_APP_CODE),
  dependencies: DEPENDENCIES,
} as const;

/** Scenario 5 — explicit disconnect is terminal (the resilience boundary). */
export const resilienceDisconnectScenario = {
  title: 'Session resilience — disconnect',
  files: makeFiles(DISCONNECT_APP_CODE),
  dependencies: DEPENDENCIES,
} as const;
