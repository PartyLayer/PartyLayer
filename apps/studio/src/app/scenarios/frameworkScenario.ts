// S8.8 — framework toggle: the SAME connect demo, running LIVE in three
// frameworks (React / Vue / Vanilla). connectScenario.ts + mockWallet.ts + the
// SDK stay byte-unchanged; this file only ADDS three scenarios. Studio-only.
//
// All three reuse the SAME framework-agnostic mock (window.canton.demoWallet,
// entry-injected). The mock is a CIP-0103 provider, so each framework reaches it
// the idiomatic way:
//   - React   : <PartyLayerProvider client={createPartyLayer(studioClientOptions)}>
//               + useConnect()/useWallets() (the connect-scenario pattern).
//   - Vue      : createPartyLayerSession({ provider: window.canton.demoWallet })
//               + useSession()/useAccount(). The plugin takes a CIP-0103 PROVIDER
//               (not a client); the injected demo wallet IS one, and its connect
//               emits statusChanged + accountsChanged — which the @partylayer/session
//               store (what the Vue composables read) subscribes to. Wrapping the
//               mock directly avoids compiling the TS adapter in Sandpack's vue
//               template and is genuine @partylayer/vue usage.
//   - Vanilla : createPartyLayer(studioClientOptions) + client.connect({ walletId })
//               directly, rendering into the DOM.
//
// The shared mock module (./mockWallet) is imported, not duplicated, so it stays
// byte-identical. The framework variants carry NO mock-driver (hideMockDriver:true)
// — the driver's '/studio-mock-config.ts' path is react-layout-specific.
import { MOCK_WALLET } from './mockWallet';

const STUDIO_MOCK_INJECT_CODE = MOCK_WALLET;

// ── Shared SDK setup (React + Vanilla) — connect's adapter/options verbatim ───
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

// ── React variant (template 'react-ts') ──────────────────────────────────────
const REACT_APP_CODE = `import { useMemo, useState } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import { PartyLayerProvider, useWallets, useConnect } from '@partylayer/react';
import { studioClientOptions } from './studio-setup';

function Demo() {
  const { wallets } = useWallets();
  const { connect, isConnecting, error } = useConnect();
  const [partyId, setPartyId] = useState<string | null>(null);

  async function onConnect(walletId: string) {
    const session = await connect({ walletId });
    if (session) setPartyId(String(session.partyId));
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, lineHeight: 1.6 }}>
      <style>{".pl-btn{font:inherit;font-size:14px;font-weight:600;color:#0B0F1A;background:#FFCC00;border:none;border-radius:10px;padding:10px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.05);cursor:pointer;transition:background .18s cubic-bezier(0.2,0.8,0.2,1),box-shadow .18s cubic-bezier(0.2,0.8,0.2,1)}.pl-btn:hover:not(:disabled){background:#E6B800;box-shadow:0 2px 4px rgba(15,23,42,0.08)}.pl-btn:disabled{opacity:.6;cursor:default}"}</style>
      <h2 style={{ margin: '0 0 4px' }}>Connect a wallet — React</h2>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
        <code>@partylayer/react</code> — useConnect() / useWallets().
      </p>
      {partyId ? (
        <p>
          Connected — partyId:{' '}
          <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 6 }}>{partyId}</code>
        </p>
      ) : (
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
      )}
      {error && (
        <pre style={{ marginTop: 8, padding: 12, background: '#2a0000', color: '#f88', fontSize: 12, whiteSpace: 'pre-wrap', borderRadius: 6 }}>
          {error.name}: {error.message}
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

const REACT_ENTRY_CODE = `import './studio-mock-inject';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

// ── Vue variant (template 'vue') ─────────────────────────────────────────────
// App.vue: destructure the composables so the ComputedRefs auto-unwrap in the
// template (Vue only auto-unwraps top-level setup refs, not refs nested in a
// plain object).
const VUE_APP_CODE = `<script setup>
import { useSession, useAccount } from '@partylayer/vue';

const { status, isConnecting, connect } = useSession();
const { party } = useAccount();

async function onConnect() {
  await connect();
}
</script>

<template>
  <div style="font-family: system-ui, sans-serif; padding: 20px; line-height: 1.6;">
    <h2 style="margin: 0 0 4px;">Connect a wallet — Vue</h2>
    <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;">
      <code>@partylayer/vue</code> — useSession() / useAccount() over the injected CIP-0103 wallet.
    </p>
    <p style="margin: 0 0 12px;">
      status: <code style="background: #f1f1f4; padding: 2px 8px; border-radius: 6px;">{{ status }}</code>
    </p>
    <button
      v-if="!party"
      @click="onConnect"
      :disabled="isConnecting"
      class="pl-btn"
    >
      {{ isConnecting ? 'Connecting…' : 'Connect Canton Demo Wallet' }}
    </button>
    <p v-else>
      Connected — partyId:
      <code style="background: #dcfce7; padding: 2px 6px; border-radius: 6px;">{{ party }}</code>
    </p>
  </div>
</template>

<style>
.pl-btn{font:inherit;font-size:14px;font-weight:600;color:#0B0F1A;background:#FFCC00;border:none;border-radius:10px;padding:10px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.05);cursor:pointer;transition:background .18s cubic-bezier(0.2,0.8,0.2,1),box-shadow .18s cubic-bezier(0.2,0.8,0.2,1)}
.pl-btn:hover:not(:disabled){background:#E6B800;box-shadow:0 2px 4px rgba(15,23,42,0.08)}
.pl-btn:disabled{opacity:.6;cursor:default}
</style>
`;

const VUE_MAIN_CODE = `import './studio-mock-inject';
import { createApp } from 'vue';
import App from './App.vue';
import { createPartyLayerSession } from '@partylayer/vue';

// The injected demo wallet is a CIP-0103 provider; the session store (read by
// the Vue composables) subscribes to its statusChanged/accountsChanged events,
// which the mock emits on connect. No SDK client needed for this binding.
const provider = window.canton.demoWallet;

const app = createApp(App);
app.use(createPartyLayerSession({ provider }));
app.mount('#app');
`;

// ── Vanilla variant (template 'vanilla-ts') ──────────────────────────────────
const VANILLA_INDEX_CODE = `import './studio-mock-inject';
import { createPartyLayer } from '@partylayer/sdk';
import { studioClientOptions } from './studio-setup';

const client = createPartyLayer(studioClientOptions);

const root = document.getElementById('app')!;
root.innerHTML = \`
  <style>
    .pl-btn{font:inherit;font-size:14px;font-weight:600;color:#0B0F1A;background:#FFCC00;border:none;border-radius:10px;padding:10px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.05);cursor:pointer;transition:background .18s cubic-bezier(0.2,0.8,0.2,1),box-shadow .18s cubic-bezier(0.2,0.8,0.2,1)}
    .pl-btn:hover:not(:disabled){background:#E6B800;box-shadow:0 2px 4px rgba(15,23,42,0.08)}
    .pl-btn:disabled{opacity:.6;cursor:default}
  </style>
  <div style="font-family: system-ui, sans-serif; padding: 20px; line-height: 1.6;">
    <h2 style="margin: 0 0 4px;">Connect a wallet — Vanilla</h2>
    <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;">
      <code>@partylayer/sdk</code> — createPartyLayer() + client.connect() directly.
    </p>
    <button id="connect-btn" class="pl-btn">
      Connect Canton Demo Wallet
    </button>
    <pre id="out" style="margin-top: 16px; padding: 12px; background: #1e1e1e; color: #0f0; font-size: 12px; white-space: pre-wrap; border-radius: 6px;"></pre>
  </div>
\`;

const btn = document.getElementById('connect-btn') as HTMLButtonElement;
const out = document.getElementById('out')!;

btn.onclick = async () => {
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try {
    const wallets = await client.listWallets();
    const session = await client.connect(wallets[0] ? { walletId: wallets[0].walletId } : undefined);
    out.textContent = session
      ? 'Connected — partyId: ' + String(session.partyId)
      : 'connect returned null (see console)';
  } catch (e) {
    out.textContent = 'connect error: ' + (e instanceof Error ? e.message : String(e));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect Canton Demo Wallet';
  }
};
`;

const VANILLA_HTML_CODE = `<!DOCTYPE html>
<html>
  <head>
    <title>PartyLayer Studio — Vanilla</title>
    <meta charset="UTF-8" />
  </head>
  <body>
    <div id="app"></div>
    <script src="index.ts"></script>
  </body>
</html>
`;

const BASE_SDK_DEPS = {
  '@partylayer/react': '0.9.4',
  '@partylayer/sdk': '0.13.2',
  '@partylayer/core': '0.9.0',
};

/** React: <PartyLayerProvider> + useConnect/useWallets (connect-scenario pattern). */
export const frameworkReactScenario = {
  title: 'Framework — React',
  template: 'react-ts',
  activeFile: '/App.tsx',
  hideMockDriver: true,
  files: {
    '/App.tsx': { code: REACT_APP_CODE, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/index.tsx': { code: REACT_ENTRY_CODE, hidden: true },
    '/studio-mock-inject.ts': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
  },
  dependencies: { ...BASE_SDK_DEPS },
} as const;

/** Vue: createPartyLayerSession({ provider: mock }) + useSession/useAccount. */
export const frameworkVueScenario = {
  title: 'Framework — Vue',
  template: 'vue',
  activeFile: '/src/App.vue',
  hideMockDriver: true,
  files: {
    '/src/App.vue': { code: VUE_APP_CODE, active: true },
    '/src/main.js': { code: VUE_MAIN_CODE, hidden: true },
    '/src/studio-mock-inject.js': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
  },
  dependencies: {
    '@partylayer/vue': '0.1.4',
    vue: '^3.4.0',
  },
} as const;

/** Vanilla: createPartyLayer + client.connect() into the DOM. */
export const frameworkVanillaScenario = {
  title: 'Framework — Vanilla',
  template: 'vanilla-ts',
  activeFile: '/index.ts',
  hideMockDriver: true,
  files: {
    '/index.ts': { code: VANILLA_INDEX_CODE, active: true },
    '/studio-setup.ts': { code: STUDIO_SETUP_CODE, hidden: true },
    '/studio-mock-inject.ts': { code: STUDIO_MOCK_INJECT_CODE, hidden: true },
    '/index.html': { code: VANILLA_HTML_CODE, hidden: true },
  },
  dependencies: {
    '@partylayer/sdk': '0.13.2',
    '@partylayer/core': '0.9.0',
  },
} as const;

/** Framework key → scenario, for the toggle. */
export type FrameworkKey = 'react' | 'vue' | 'vanilla';
export const FRAMEWORK_VARIANTS: Record<FrameworkKey, typeof frameworkReactScenario | typeof frameworkVueScenario | typeof frameworkVanillaScenario> = {
  react: frameworkReactScenario,
  vue: frameworkVueScenario,
  vanilla: frameworkVanillaScenario,
};

export const FRAMEWORK_OPTIONS: { key: FrameworkKey; label: string }[] = [
  { key: 'react', label: 'React' },
  { key: 'vue', label: 'Vue' },
  { key: 'vanilla', label: 'Vanilla' },
];
