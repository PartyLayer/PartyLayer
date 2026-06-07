/**
 * WalletConnect adapter tests — the official @canton-network/dapp-sdk adapter is
 * mocked (no real projectId / network needed). Functional tests inject the
 * official adapter via `createOfficialAdapter`; the lazy-import proof uses the
 * default dynamic-import path with a mocked dapp-sdk module to assert deferral.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CapabilityNotSupportedError,
  toPartyId,
  toSessionId,
  toWalletId,
  type AdapterContext,
  type CapabilityKey,
  type Session,
} from '@partylayer/core';

// Tracks whether the dapp-sdk barrel was loaded (for the lazy-import proof).
const h = vi.hoisted(() => ({ dappSdkLoaded: false }));
vi.mock('@canton-network/dapp-sdk', () => {
  h.dappSdkLoaded = true;
  return {
    WalletConnectAdapter: {
      create: (cfg: { onUri?: (u: string) => void }) => ({
        request: async (args: { method: string }) => {
          if (args.method === 'connect') {
            cfg.onUri?.('wc:default@2');
            return { isConnected: true };
          }
          if (args.method === 'getPrimaryAccount') return { partyId: 'party::default' };
          return {};
        },
        on: () => undefined,
        removeListener: () => undefined,
        teardown: () => undefined,
        restore: async () => null,
        detect: async () => true,
      }),
    },
  };
});

import { WalletConnectAdapter } from '../walletconnect-adapter';

// ── Harness ──────────────────────────────────────────────────────────────────

function createMockContext(): AdapterContext {
  return {
    appName: 'Test dApp',
    origin: 'https://test.example.com',
    network: 'mainnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  };
}

function createMockSession(): Session {
  return {
    sessionId: toSessionId('sess-wc'),
    walletId: toWalletId('walletconnect'),
    partyId: toPartyId('party::wc-1'),
    network: 'mainnet',
    createdAt: Date.now(),
    origin: 'https://test.example.com',
    capabilitiesSnapshot: ['connect'] as CapabilityKey[],
  };
}

interface MockOfficialOptions {
  restoreReturns?: boolean;
}

/** A mock of the official WalletConnectAdapter with event buffering. */
function makeMockOfficial(cfg: { onUri?: (u: string) => void }, opts: MockOfficialOptions = {}) {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const buffer: Array<{ event: string; args: unknown[] }> = [];
  let connected = false;

  function dispatch(event: string, ...args: unknown[]): void {
    const set = listeners.get(event);
    if (set && set.size > 0) set.forEach((l) => l(...args));
    else buffer.push({ event, args }); // buffered until a listener attaches
  }

  const teardown = vi.fn();

  const wc = {
    __cfg: cfg,
    teardown,
    request: vi.fn(async (args: { method: string; params?: unknown }) => {
      switch (args.method) {
        case 'connect':
          cfg.onUri?.('wc:abc123@2?relay-protocol=irn&symKey=deadbeef');
          connected = true;
          // a tx event arrives before any listener attaches → must be buffered
          dispatch('txChanged', { status: 'executed', commandId: 'cmd-1' });
          return { isConnected: true };
        case 'getPrimaryAccount':
          return {
            partyId: 'party::wc-1',
            publicKey: 'wc-pubkey',
            namespace: 'wc-ns',
            networkId: 'canton:da-mainnet',
            signingProviderId: 'wc-signer',
            hint: 'wc-hint',
          };
        case 'status':
          return {
            network: { networkId: 'canton:da-mainnet', ledgerApi: { baseUrl: 'https://wc.example' } },
            session: { userId: 'wc-user', expiresAt: 9_999_999_999_999 },
          };
        case 'prepareExecuteAndWait':
          return { tx: { commandId: 'cmd-2', payload: { updateId: 'update-2' } } };
        case 'disconnect':
          connected = false;
          return null;
        default:
          return {};
      }
    }),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
      // flush buffered events for this event to the late listener
      for (const b of buffer.filter((x) => x.event === event)) listener(...b.args);
      return wc;
    }),
    removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(listener);
      return wc;
    }),
    restore: vi.fn(async () => (opts.restoreReturns ? wc : null)),
    detect: vi.fn(async () => true),
    /** Test helper: emit an event live (not buffered). */
    __emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((l) => l(...args));
    },
  };
  return wc;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectAdapter — identity & detection', () => {
  it('requires a projectId', () => {
    expect(() => new WalletConnectAdapter({ projectId: '' })).toThrow(/projectId/);
  });

  it('has walletId "walletconnect" and name "WalletConnect"', () => {
    const a = new WalletConnectAdapter({ projectId: 'p' });
    expect(a.walletId).toBe(toWalletId('walletconnect'));
    expect(a.name).toBe('WalletConnect');
  });

  it('detectInstalled() is available when a projectId is configured (no dapp-sdk import)', async () => {
    const before = h.dappSdkLoaded;
    const a = new WalletConnectAdapter({ projectId: 'p' });
    const detect = await a.detectInstalled();
    expect(detect.installed).toBe(true);
    // detection must not trigger the dapp-sdk dynamic import
    expect(h.dappSdkLoaded).toBe(before);
  });

  it('declares WC capabilities incl. remoteSigner; not signTransaction', () => {
    const caps = new WalletConnectAdapter({ projectId: 'p' }).getCapabilities();
    expect(caps).toEqual(
      expect.arrayContaining(['connect', 'submitTransaction', 'ledgerApi', 'events', 'remoteSigner']),
    );
    expect(caps).not.toContain('signTransaction');
  });

  it('getInfo() exposes a picker-friendly id/name/icon', () => {
    const info = new WalletConnectAdapter({ projectId: 'p' }).getInfo();
    expect(info).toMatchObject({ id: 'walletconnect', name: 'WalletConnect' });
    expect(info.icon).toMatch(/^data:image\/svg\+xml/);
  });
});

describe('WalletConnectAdapter — connect', () => {
  it('establishes a session, fires onUri (QR hook), and returns AdapterConnectResult', async () => {
    const onUri = vi.fn();
    const adapter = new WalletConnectAdapter(
      { projectId: 'p', onUri },
      { createOfficialAdapter: (cfg) => makeMockOfficial(cfg) },
    );
    const ctx = createMockContext();

    const result = await adapter.connect(ctx);

    expect(onUri).toHaveBeenCalledWith(expect.stringMatching(/^wc:/)); // pairing URI → modal QR
    expect(result.partyId).toBe(toPartyId('party::wc-1'));
    expect(result.session.walletId).toBe(toWalletId('walletconnect'));
    expect(result.session.metadata?.transport).toBe('walletconnect');
    expect(result.session.metadata?.publicKey).toBe('wc-pubkey');
    expect(result.session.metadata?.userId).toBe('wc-user');
    expect(result.session.expiresAt).toBe(9_999_999_999_999);
    expect(result.capabilities).toEqual(adapter.getCapabilities());
  });

  it('forwards onUri + metadata into the official adapter config', async () => {
    let captured: Record<string, unknown> | undefined;
    const adapter = new WalletConnectAdapter(
      {
        projectId: 'proj-1',
        metadata: { name: 'My dApp', description: 'd', url: 'https://x', icons: ['https://x/i.png'] },
        onUri: vi.fn(),
      },
      {
        createOfficialAdapter: (cfg) => {
          captured = cfg;
          return makeMockOfficial(cfg);
        },
      },
    );
    await adapter.connect(createMockContext());
    expect(captured?.projectId).toBe('proj-1');
    expect(captured?.metadata).toMatchObject({ name: 'My dApp' });
    expect(typeof captured?.onUri).toBe('function');
    // chainId left unset by default
    expect(captured?.chainId).toBeUndefined();
  });
});

describe('WalletConnectAdapter — events (delegation + buffering)', () => {
  it('delivers a buffered txChanged to a late-attached txStatus listener (translated)', async () => {
    const official = makeMockOfficial({});
    const adapter = new WalletConnectAdapter(
      { projectId: 'p' },
      { createOfficialAdapter: () => official },
    );
    await adapter.connect(createMockContext()); // buffers a txChanged('executed') before any listener

    const handler = vi.fn();
    const unsub = adapter.on('txStatus', handler); // attaches late → buffer flushes

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ status: 'committed', commandId: 'cmd-1' });

    // unsubscribe → official.removeListener; subsequent live events not delivered
    unsub();
    expect(official.removeListener).toHaveBeenCalledWith('txChanged', expect.any(Function));
    official.__emit('txChanged', { status: 'pending', commandId: 'cmd-9' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('on() before connect is a safe no-op', () => {
    const adapter = new WalletConnectAdapter({ projectId: 'p' });
    expect(() => adapter.on('txStatus', vi.fn())()).not.toThrow();
  });
});

describe('WalletConnectAdapter — disconnect / restore / submit', () => {
  it('disconnect() requests disconnect then teardown()s', async () => {
    const official = makeMockOfficial({});
    const adapter = new WalletConnectAdapter(
      { projectId: 'p' },
      { createOfficialAdapter: () => official },
    );
    await adapter.connect(createMockContext());
    await adapter.disconnect(createMockContext(), createMockSession());
    expect(official.request).toHaveBeenCalledWith({ method: 'disconnect' });
    expect(official.teardown).toHaveBeenCalledTimes(1);
  });

  it('restore() returns a Session when the official adapter restores', async () => {
    const official = makeMockOfficial({}, { restoreReturns: true });
    const adapter = new WalletConnectAdapter(
      { projectId: 'p' },
      { createOfficialAdapter: () => official },
    );
    const restored = await adapter.restore(createMockContext(), createMockSession());
    expect(restored).not.toBeNull();
    expect(restored!.walletId).toBe(toWalletId('walletconnect'));
  });

  it('restore() returns null when the official adapter has no session', async () => {
    const official = makeMockOfficial({}, { restoreReturns: false });
    const adapter = new WalletConnectAdapter(
      { projectId: 'p' },
      { createOfficialAdapter: () => official },
    );
    expect(await adapter.restore(createMockContext(), createMockSession())).toBeNull();
  });

  it('submitTransaction() goes through prepareExecuteAndWait', async () => {
    const official = makeMockOfficial({});
    const adapter = new WalletConnectAdapter(
      { projectId: 'p' },
      { createOfficialAdapter: () => official },
    );
    const receipt = await adapter.submitTransaction(createMockContext(), createMockSession(), {
      signedTx: { commands: [] },
    });
    expect(String(receipt.transactionHash)).toBe('update-2');
  });

  it('signTransaction() throws CapabilityNotSupportedError', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'p' });
    await expect(
      adapter.signTransaction(createMockContext(), createMockSession(), { tx: {} }),
    ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
  });
});

describe('WalletConnectAdapter — lazy import proof', () => {
  it('importing the entry + detectInstalled does NOT load dapp-sdk; connect() (default path) does', async () => {
    h.dappSdkLoaded = false;

    // Importing the package entry must not pull dapp-sdk.
    const mod = await import('../index');
    expect(h.dappSdkLoaded).toBe(false);

    // Constructing + detecting must not pull dapp-sdk either.
    const adapter = new mod.WalletConnectAdapter({ projectId: 'p' });
    await adapter.detectInstalled();
    expect(h.dappSdkLoaded).toBe(false);

    // Only the default connect() path triggers the dynamic import.
    await adapter.connect(createMockContext());
    expect(h.dappSdkLoaded).toBe(true);
  });
});
