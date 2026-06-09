/**
 * Network-mismatch enforcement tests (A1b).
 *
 * A mock adapter reports a wallet network via its connect result; the client is
 * configured for a different network. We assert detection + the 'off'/'guard'/
 * 'strict' policy semantics + the `session:networkMismatch` event payload.
 */
import { describe, it, expect, vi } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively → Console's SDK imports
// SVGs that explode under Node. Stub at the module boundary.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  toPartyId,
  toSignature,
  NetworkMismatchError,
  type AdapterConnectResult,
  type AdapterDetectResult,
  type CapabilityKey,
  type SignedMessage,
  type WalletAdapter,
} from '@partylayer/core';
import { createPartyLayer } from './client';

class MockNetAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-net');
  readonly name = 'Mock Net Wallet';
  constructor(private readonly walletNetwork: string) {}
  getCapabilities(): CapabilityKey[] {
    return ['connect', 'signMessage'];
  }
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true };
  }
  async connect(): Promise<AdapterConnectResult> {
    return {
      partyId: toPartyId('party::mock'),
      // The wallet reports ITS network here (the SDK reads result.session.network).
      session: { walletId: this.walletId, network: this.walletNetwork, createdAt: Date.now() },
      capabilities: ['connect', 'signMessage'],
    };
  }
  async disconnect(): Promise<void> {}
  signMessage = vi.fn(
    async (): Promise<SignedMessage> =>
      ({ signature: toSignature('0xsig'), signedAt: Date.now() } as unknown as SignedMessage),
  );
}

const noopStorage = { get: async () => null, set: async () => {}, remove: async () => {}, clear: async () => {} };
const idCrypto = {
  encrypt: async (d: string) => d,
  decrypt: async (d: string) => d,
  generateKey: async () => 'k',
};

function makeClient(opts: {
  configNetwork: string;
  walletNetwork: string;
  enforcement?: 'off' | 'guard' | 'strict';
}) {
  return createPartyLayer({
    network: opts.configNetwork as 'devnet' | 'testnet' | 'mainnet',
    app: { name: 'net-enforcement-test', origin: 'https://test.example.com' },
    adapters: [new MockNetAdapter(opts.walletNetwork)],
    ...(opts.enforcement ? { networkEnforcement: opts.enforcement } : {}),
    storage: noopStorage as never,
    crypto: idCrypto as never,
  });
}

describe('network enforcement', () => {
  it("'strict' blocks connect on a mismatch (and still emits the event)", async () => {
    const client = makeClient({ configNetwork: 'mainnet', walletNetwork: 'devnet', enforcement: 'strict' });
    const events: unknown[] = [];
    client.on('session:networkMismatch', (e) => events.push(e));
    await expect(client.connect({ walletId: toWalletId('mock-net') })).rejects.toBeInstanceOf(NetworkMismatchError);
    expect(events).toEqual([
      {
        type: 'session:networkMismatch',
        sessionId: expect.anything(),
        expected: 'canton:da-mainnet',
        actual: 'canton:da-devnet',
        enforced: true,
      },
    ]);
  });

  it("'guard' (default) lets connect proceed (flag set) but blocks transactions", async () => {
    const client = makeClient({ configNetwork: 'mainnet', walletNetwork: 'devnet' }); // default guard
    const session = await client.connect({ walletId: toWalletId('mock-net') });
    expect(session.networkMismatch).toEqual({ expected: 'canton:da-mainnet', actual: 'canton:da-devnet' });
    await expect(client.signMessage({ message: 'hello' } as never)).rejects.toBeInstanceOf(NetworkMismatchError);
  });

  it("'off' detects + flags + emits but never blocks", async () => {
    const client = makeClient({ configNetwork: 'mainnet', walletNetwork: 'devnet', enforcement: 'off' });
    const events: Array<{ enforced: boolean }> = [];
    client.on('session:networkMismatch', (e) => events.push(e as { enforced: boolean }));
    const session = await client.connect({ walletId: toWalletId('mock-net') });
    expect(session.networkMismatch).toEqual({ expected: 'canton:da-mainnet', actual: 'canton:da-devnet' });
    expect(events[0]?.enforced).toBe(false);
    await expect(client.signMessage({ message: 'hello' } as never)).resolves.toBeTruthy();
  });

  it('matched networks: no flag, no event, transaction proceeds', async () => {
    const client = makeClient({ configNetwork: 'devnet', walletNetwork: 'devnet', enforcement: 'guard' });
    const events: unknown[] = [];
    client.on('session:networkMismatch', (e) => events.push(e));
    const session = await client.connect({ walletId: toWalletId('mock-net') });
    expect(session.networkMismatch).toBeUndefined();
    expect(events).toEqual([]);
    await expect(client.signMessage({ message: 'hello' } as never)).resolves.toBeTruthy();
  });
});
