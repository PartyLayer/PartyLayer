/**
 * Bron adapter: no invented transaction hash.
 *
 * Bron reports a `transactionHash` only sometimes. When it did not, the adapter
 * returned `toTransactionHash('pending')` — the literal word "pending" typed as
 * a hash. These two sites survived an earlier survey of this repository's
 * placeholder values precisely because they were ternaries rather than `??`
 * chains, which is its own small lesson about grepping for known shapes.
 *
 * With `SignedTransaction.transactionHash` optional, an absent hash is now
 * absent.
 */
import { describe, it, expect, vi } from 'vitest';
import { BronAdapter } from './bron-adapter';
import type { AdapterContext, Session } from '@partylayer/core';
import { toPartyId, toSessionId, toWalletId } from '@partylayer/core';

function ctx(): AdapterContext {
  return {
    appName: 'Test',
    origin: 'https://test.example.com',
    network: 'devnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: {} as never,
    storage: {} as never,
    timeout: (() => new Promise(() => {})) as never,
  } as unknown as AdapterContext;
}

function session(): Session {
  return {
    sessionId: toSessionId('s-1'),
    walletId: toWalletId('bron'),
    partyId: toPartyId('party::alice'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.example.com',
    capabilitiesSnapshot: ['connect'],
    metadata: { sessionId: 'bron-session-1' },
  };
}

/** A Bron adapter whose API client is replaced with a scripted double. */
function makeAdapter(requestSignature: () => unknown): BronAdapter {
  const adapter = new BronAdapter({
    auth: {
      authorizationUrl: 'https://auth.example/authorize',
      tokenUrl: 'https://auth.example/token',
      clientId: 'client',
      redirectUri: 'https://app.example/callback',
    },
    api: { baseUrl: 'https://api.example' },
  } as never);
  (adapter as unknown as { apiClient: unknown }).apiClient = {
    requestSignature: vi.fn(async () => requestSignature()),
    pollRequestStatus: vi.fn(async () => requestSignature()),
  };
  return adapter;
}

describe('BronAdapter omits a transaction hash it does not have', () => {
  it('omits transactionHash when Bron reports none', async () => {
    // Was `toTransactionHash('pending')`.
    const signed = await makeAdapter(() => ({
      requestId: 'req-1',
      status: 'approved',
      signature: 'sig-real',
    })).signTransaction(ctx(), session(), { tx: { commands: [] } });

    expect(signed.transactionHash).toBeUndefined();
    expect('transactionHash' in signed).toBe(false);
    // The signature it does have is still reported, on the signed payload.
    expect(signed.signedTx).toMatchObject({ signature: 'sig-real' });
  });

  it('reports transactionHash when Bron does supply one', async () => {
    const signed = await makeAdapter(() => ({
      requestId: 'req-2',
      status: 'approved',
      signature: 'sig-real',
      transactionHash: 'hash-real',
    })).signTransaction(ctx(), session(), { tx: { commands: [] } });

    expect(String(signed.transactionHash)).toBe('hash-real');
  });

  it('never reports the word "pending" as a hash', async () => {
    const signed = await makeAdapter(() => ({
      requestId: 'req-3',
      status: 'approved',
      signature: 'sig',
    })).signTransaction(ctx(), session(), { tx: { commands: [] } });

    expect(signed.transactionHash).not.toBe('pending');
  });
});
