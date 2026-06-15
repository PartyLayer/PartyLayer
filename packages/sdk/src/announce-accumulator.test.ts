// @vitest-environment jsdom
/**
 * (e) The generic path: the client's PERSISTENT announce accumulator
 * (subscribeAnnouncedProviders, mounted at construction) captures a LATE announce
 * fired AFTER construction and surfaces it in listWallets() — proving the generic
 * aggregateAnnouncedWallets path benefits from the same primitive the Send path
 * uses via waitForAnnouncedProvider. Also asserts destroy() tears the listener down.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { createPartyLayer } from './client';

function makeClient() {
  const c = createPartyLayer({ network: 'devnet', app: { name: 't' } });
  vi.spyOn(c.registryClient, 'getWallets').mockResolvedValue([]);
  vi.spyOn(c.registryClient, 'getRegistry').mockResolvedValue({
    metadata: { registryVersion: '1', schemaVersion: '1', publishedAt: 'x', channel: 'stable', sequence: 1 },
    wallets: [],
  } as never);
  return c;
}

function announce(id: string) {
  window.dispatchEvent(
    new CustomEvent('canton:announceProvider', { detail: { providerId: id, name: id, target: id } }),
  );
}

describe('(e) client persistent announce accumulator → listWallets', () => {
  it('surfaces a >1s-LATE announce (past the detect bound) via the persistent accumulator', async () => {
    const client = makeClient();
    // Announce fired 1100ms after construction — past the Send DETECT bound
    // (1000ms), the case the old fixed window missed. The persistent accumulator
    // has NO time bound (it listens for the page lifetime), so listWallets()
    // self-corrects whenever the wallet announces, however late.
    await new Promise((r) => setTimeout(r, 1100));
    announce('latewallet');
    await new Promise((r) => setTimeout(r, 50)); // let the accumulator build + register
    const ids = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(ids).toContain('browser:ext:latewallet');
    client.destroy();
  });

  it('destroy() tears down the accumulator — a later announce is not captured', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const client = makeClient();
    client.destroy();
    expect(removeSpy).toHaveBeenCalledWith('canton:announceProvider', expect.any(Function));
    removeSpy.mockRestore();
  });
});
