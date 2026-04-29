/**
 * Coverage for the additive `client.getAdapter()` lookup.
 *
 * The picker uses this to render a per-wallet readiness indicator by
 * calling each adapter's own `detectInstalled()` — which knows the
 * adapter's transport (Console: postMessage; Send: window.canton; etc.)
 * and produces the right answer without UI-side hardcoded probes.
 *
 * Two guarantees we keep test-pinned:
 *   1. Returns the same instance the SDK uses for connect / sign /
 *      submit — not a wrapper, not a copy.
 *   2. Accepts both branded `WalletId` and raw string forms so
 *      consumers can pass either without coercion ceremony.
 */

import { describe, expect, it, vi } from 'vitest';

// Console's SDK imports SVGs which explode under Node. Stub at the
// module boundary so we can construct a PartyLayerClient that goes
// through `createPartyLayer` (which imports getBuiltinAdapters
// transitively even when we pass a custom adapter array).
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type WalletAdapter,
  type WalletId,
} from '@partylayer/core';

import { createPartyLayer } from './client';

class StubAdapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  detectInstalled = vi.fn(async (): Promise<AdapterDetectResult> => ({ installed: false }));

  constructor(id: string, name: string) {
    this.walletId = toWalletId(id);
    this.name = name;
  }

  getCapabilities(): CapabilityKey[] {
    return ['connect'];
  }

  async connect(_ctx: AdapterContext): Promise<AdapterConnectResult> {
    throw new Error('not implemented (test stub)');
  }
}

function makeClient(): {
  client: ReturnType<typeof createPartyLayer>;
  console: StubAdapter;
  send: StubAdapter;
} {
  const consoleAdapter = new StubAdapter('console', 'Console Wallet');
  const sendAdapter = new StubAdapter('send', 'Send');
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'getAdapter unit-test', origin: 'https://test.example.com' },
    adapters: [consoleAdapter, sendAdapter],
  });
  return { client, console: consoleAdapter, send: sendAdapter };
}

describe('PartyLayerClient.getAdapter', () => {
  it('returns the registered adapter instance for a known wallet id', () => {
    const { client, console: consoleAdapter } = makeClient();
    expect(client.getAdapter(consoleAdapter.walletId)).toBe(consoleAdapter);
  });

  it('returns undefined for an unknown wallet id', () => {
    const { client } = makeClient();
    expect(client.getAdapter('nonexistent')).toBeUndefined();
  });

  it('accepts a raw string (no WalletId branding) and looks up correctly', () => {
    const { client, send } = makeClient();
    expect(client.getAdapter('send')).toBe(send);
  });

  it('returns the SAME instance the SDK uses internally — not a wrapper', () => {
    const { client, console: consoleAdapter } = makeClient();
    const looked = client.getAdapter('console');
    expect(looked).toBe(consoleAdapter);
    // Direct mutation visible across both references → confirms identity.
    consoleAdapter.detectInstalled.mockResolvedValue({ installed: true });
    expect(looked).toBeDefined();
    return looked!.detectInstalled().then((r) => {
      expect(r.installed).toBe(true);
    });
  });

  it('reflects adapters added after construction via registerAdapter', () => {
    const { client } = makeClient();
    const late = new StubAdapter('late', 'Late Adapter');
    client.registerAdapter(late);
    expect(client.getAdapter('late')).toBe(late);
  });
});
