/**
 * D2: the connect deadline must be ONE number, must be the number reported,
 * and must actually cancel the adapter rather than leaving its popup live.
 *
 * Before this change there were two independent defaults — 120000 at the race
 * and 30000 in the catch block that formatted the message — so a connect that
 * ran the full 120s was reported as "timed out after 30000ms". And
 * `Promise.race` never cancelled the loser, so the wallet popup stayed open.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { toWalletId, type WalletAdapter } from '@partylayer/core';
import { createPartyLayer, DEFAULT_CONNECT_TIMEOUT_MS } from './client';

/** An adapter that never resolves, and records whether it was cancelled. */
function hangingAdapter(): WalletAdapter & { aborted: boolean; sawSignal: boolean } {
  const a = {
    walletId: toWalletId('hang'),
    name: 'Hanging Wallet',
    aborted: false,
    sawSignal: false,
    getCapabilities: () => ['connect', 'disconnect'],
    detectInstalled: async () => ({ installed: true }),
    connect: (_ctx: unknown, opts?: { signal?: AbortSignal }) => {
      a.sawSignal = !!opts?.signal;
      opts?.signal?.addEventListener('abort', () => { a.aborted = true; });
      return new Promise(() => {}); // never settles
    },
    disconnect: async () => {},
  } as unknown as WalletAdapter & { aborted: boolean; sawSignal: boolean };
  return a;
}

function makeClient(adapter: WalletAdapter) {
  const client = createPartyLayer({
    network: 'devnet', app: { name: 'test' }, adapters: [adapter] as never,
  });
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([]);
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({
    metadata: { registryVersion: '1', schemaVersion: '1', publishedAt: 'x', channel: 'stable', sequence: 1 },
    wallets: [] as never,
  } as never);
  return client;
}

describe('D2: connect deadline', () => {
  it('exports ONE default, used by both the race and the error message', () => {
    expect(DEFAULT_CONNECT_TIMEOUT_MS).toBe(120000);
  });

  it('does not overwrite a wallet-reported deadline with the connect default', async () => {
    // The adapter times out on ITS OWN budget and says so. The SDK used to hand
    // `context.timeoutMs` to the mapper, which took precedence — so the wallet's
    // real figure was replaced by whichever default the catch block held.
    const adapter = hangingAdapter();
    (adapter as unknown as { connect: unknown }).connect = async () => {
      throw new Error('Wallet connect timed out after 7500ms');
    };
    const client = makeClient(adapter);

    let err: unknown;
    try { await client.connect({ walletId: toWalletId('hang') }); } catch (e) { err = e; }

    expect((err as { code?: string }).code).toBe('TIMEOUT');
    expect((err as Error).message).toContain('7500ms');
    expect((err as Error).message).not.toContain('30000ms');
    expect((err as Error).message).not.toContain('120000ms');
  });

  it('hands the adapter an AbortSignal and aborts it when the deadline fires', async () => {
    const adapter = hangingAdapter();
    const client = makeClient(adapter);

    try {
      await client.connect({ walletId: toWalletId('hang'), timeoutMs: 60 });
    } catch { /* expected */ }

    expect(adapter.sawSignal).toBe(true);
    expect(adapter.aborted).toBe(true);
  });
});
