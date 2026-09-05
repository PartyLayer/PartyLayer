// @vitest-environment jsdom
/**
 * D5: a wallet we already know must never be minted a SECOND picker row.
 *
 * Observed live on the demo surface: the demo's own test wallet appeared twice —
 * once as its registered adapter, and once as a synthesized unknown-wallet row
 * whose click connected to the same provider. Nightly duplicates the same way
 * against the real extension.
 *
 * MECHANISM. `discoverAllProviders` resolves an injected provider's identity
 * (via `provider.id`, else a `status()` probe). The identity guard in
 * `aggregateAnnouncedWallets` only drops entries whose identity did NOT resolve,
 * so a RESOLVED one proceeds correctly — and then the identity bridge fails to
 * match it, because `findMatchingWalletInfo` consults ONLY `providerDetection`,
 * which 8 of 10 registry entries do not carry and a registered adapter never
 * has. Nothing maps the provider back to the wallet already in the list, so the
 * unknown branch mints a twin.
 *
 * The fallback keys on IDENTITY FIELDS ONLY — the wallet id and the declared
 * injection global. Deliberately NOT the display name: names are localisable,
 * vendor-changeable and collidable, and two wallets both calling themselves
 * "Canton Wallet" would mis-bridge silently. That is the same substring-ish
 * matching removed from the error classifier in #326; it does not belong here.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { toWalletId, type CIP0103Provider, type WalletAdapter } from '@partylayer/core';
import { createPartyLayer } from './client';

/** An injected provider with NO `id`, resolving its identity through status(). */
function injectedProvider(resolvedId: string): CIP0103Provider {
  const p = {
    request: vi.fn(async ({ method }: { method: string }) =>
      method === 'status' ? { provider: { id: resolvedId, providerType: 'browser' } } : {},
    ),
    on: () => p, emit: () => false, removeListener: () => p,
  } as unknown as CIP0103Provider;
  return p;
}

function registeredAdapter(id: string): WalletAdapter {
  return {
    walletId: toWalletId(id),
    name: 'Registered Wallet',
    getCapabilities: () => ['connect', 'disconnect'],
    detectInstalled: async () => ({ installed: true, availability: { kind: 'installed' } }),
    connect: async () => ({ partyId: 'p::1', session: {}, capabilities: [] }),
    disconnect: async () => {},
  } as unknown as WalletAdapter;
}

describe('D5: the identity bridge must not mint a twin', () => {
  it('does not add a browser:ext row for a provider whose id IS a registered adapter', async () => {
    // The demo's shape: an adapter registered under `canton-demo`, and an
    // injected provider at window.canton.<key> resolving to the same identity.
    (window as unknown as Record<string, unknown>).canton = {
      demoWallet: injectedProvider('canton-demo'),
    };

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'test' },
      adapters: [registeredAdapter('canton-demo')] as never,
    } as never);
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([] as never);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) =>
      String(w.walletId),
    );

    expect(ids).toContain('canton-demo');
    expect(ids.filter((i) => i.startsWith('browser:ext:'))).toEqual([]);
    expect(ids.filter((i) => i.includes('canton-demo'))).toHaveLength(1);

    delete (window as unknown as Record<string, unknown>).canton;
  });

  it('does not add a browser:ext row for a provider ANNOUNCING a known registry id', async () => {
    // The second observed shape, and the one originally reported as "Nightly
    // appears twice". It is SURFACE-DEPENDENT: it needs something to announce
    // on the wallet's id, which the announce-comparison page elicited by
    // dispatching `canton:requestProvider`, and which kit-demo does not do. The
    // registry row and the announced provider then describe the same wallet and
    // nothing maps one to the other.
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent('canton:announceProvider', {
          detail: { id: 'nightly', name: 'Nightly', target: 'nightly' },
        }),
      );
    window.addEventListener('canton:requestProvider', announce);

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'test' },
      adapters: [] as never,
    } as never);
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([
      {
        walletId: toWalletId('nightly'), name: 'Nightly', website: '', icons: {},
        capabilities: ['connect', 'disconnect'],
        adapter: { packageName: 'x', versionRange: '*' }, docs: [],
        networks: ['devnet'], channel: 'stable',
        installHints: { injectedKey: 'nightly' },
      },
    ] as never);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) =>
      String(w.walletId),
    );

    expect(ids).toContain('nightly');
    expect(ids).not.toContain('browser:ext:nightly');
    expect(ids.filter((i) => i.includes('nightly'))).toHaveLength(1);

    window.removeEventListener('canton:requestProvider', announce);
  });
});
