// @vitest-environment jsdom
/**
 * Reactive wallet-list (the presentation half of the announce race fix).
 *
 * When a wallet announces LATE (canton:announceProvider after the picker already
 * loaded), the SDK now: records it in the live accumulator, invalidates the
 * one-shot announce cache, and emits a DEBOUNCED 'wallets:changed' signal so a
 * reactive consumer re-lists and the wallet appears with no manual refresh.
 *
 * Proven here at the SDK layer: (a) late announce → wallets:changed → a re-list
 * surfaces browser:ext:<id>; (c) gesture-sync warm plans survive the re-list
 * (warmPlans ⟂ announceEntriesCache); (d) a burst is debounced to ONE emit;
 * (e) byte-identical idle; (f) destroy() clears the debounce timer + listener.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively (Console SDK imports
// SVGs that explode under Node) — stub at the module boundary.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  toPartyId,
  WalletNotFoundError,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type CIP0103Provider,
  type OfficialProviderAdapter,
  type WalletAdapter,
} from '@partylayer/core';
import { createPartyLayer } from './client';

const DEBOUNCE_SETTLE_MS = 120; // > the 50ms wallets:changed debounce window

function announce(id: string): void {
  window.dispatchEvent(
    new CustomEvent('canton:announceProvider', { detail: { providerId: id, name: id, target: id } }),
  );
}

/** Walley-shaped official adapter (eventless popup/remote) for the warm-plan test. */
function eventlessProvider(): CIP0103Provider {
  const handlers: Record<string, unknown> = {
    connect: { isConnected: true },
    getPrimaryAccount: { partyId: 'party::walley-1', networkId: 'canton:da-devnet' },
    status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    disconnect: null,
  };
  const provider: CIP0103Provider = {
    request: vi.fn(async (args: { method: string }) => handlers[args.method]) as CIP0103Provider['request'],
    on: () => provider,
    emit: () => false,
    removeListener: () => provider,
  };
  return provider;
}
function makeOfficial(): OfficialProviderAdapter & { detect: ReturnType<typeof vi.fn> } {
  const provider = eventlessProvider();
  return {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => provider),
  } as OfficialProviderAdapter & { detect: ReturnType<typeof vi.fn> };
}

function makeClient(adapters?: (WalletAdapter | OfficialProviderAdapter)[]) {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'wallets-changed test', origin: 'https://test.example.com' },
    // announceTimeoutMs:0 → the per-listWallets discover handshake resolves fast
    // (the late wallet still surfaces via the live announceRegistry merge).
    discovery: { announceTimeoutMs: 0 },
    adapters: adapters as never,
  });
  const getWallets = vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([]);
  vi.spyOn(client.registryClient, 'getWalletEntry').mockRejectedValue(new WalletNotFoundError('x'));
  return { client, getWallets };
}

const WALLEY = toWalletId('walley');

describe('reactive wallet-list — wallets:changed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('(a) a late announce → wallets:changed → a re-list surfaces browser:ext:<id>', async () => {
    const { client } = makeClient();
    const before = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(before).not.toContain('browser:ext:latewallet');

    const changed = vi.fn();
    client.on('wallets:changed', changed);
    announce('latewallet'); // AFTER the picker already listed
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    expect(changed.mock.calls[0][0]).toEqual({ type: 'wallets:changed', reason: 'announced' });

    const after = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(after).toContain('browser:ext:latewallet');
    client.destroy();
  });

  it('(c) gesture-sync intact: a warm popup plan survives a wallets:changed re-list', async () => {
    const official = makeOfficial();
    const { client, getWallets } = makeClient([official]);

    await client.listWallets({ includeExperimental: true }); // warms WALLEY
    await vi.waitFor(() => expect(official.detect).toHaveBeenCalled());

    const changed = vi.fn();
    client.on('wallets:changed', changed);
    announce('latewallet'); // invalidates announce cache + emits — must NOT touch warmPlans
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());

    await client.listWallets({ includeExperimental: true }); // the consumer's reactive re-list

    getWallets.mockClear();
    const session = await client.connect({ walletId: WALLEY });
    expect(session.walletId).toBe(WALLEY);
    // Fast-path: the warm plan survived the announce + re-list (no inline re-resolve).
    expect(getWallets).not.toHaveBeenCalled();
    client.destroy();
  });

  it('(d) a burst of announces is debounced to ONE wallets:changed emit', async () => {
    const { client } = makeClient();
    await client.listWallets({ includeExperimental: true });

    const changed = vi.fn();
    client.on('wallets:changed', changed);
    announce('w1');
    announce('w2');
    announce('w3');
    announce('w4'); // all within the same ~tick → one debounce window
    await vi.waitFor(() => expect(changed).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(changed).toHaveBeenCalledTimes(1);
    client.destroy();
  });

  it('(e) byte-identical idle: zero announces → no emit, listWallets() unchanged', async () => {
    const { client } = makeClient();
    const changed = vi.fn();
    client.on('wallets:changed', changed);
    const a = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    const b = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(changed).not.toHaveBeenCalled();
    expect(a).toEqual(b);
    client.destroy();
  });

  it('(f) destroy() clears the debounce timer + announce listener (no late emit, no leak)', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { client } = makeClient();
    await client.listWallets({ includeExperimental: true });

    const changed = vi.fn();
    client.on('wallets:changed', changed);
    announce('willbeclipped');
    await new Promise((r) => setTimeout(r, 10)); // accumulator ran → timer armed (fires at ~50ms)
    client.destroy(); // clears the armed timer BEFORE it fires + removes the listener
    expect(removeSpy).toHaveBeenCalledWith('canton:announceProvider', expect.any(Function));

    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(changed).not.toHaveBeenCalled(); // timer cleared → no late emit

    announce('afterdestroy'); // listener removed → not captured
    await new Promise((r) => setTimeout(r, DEBOUNCE_SETTLE_MS));
    expect(changed).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
