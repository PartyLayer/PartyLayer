/**
 * Conformance: network-truthfulness contract.
 *
 * An adapter's connect() must surface the wallet's EFFECTIVE network in
 * session.network, not merely echo the requested ctx.network.
 */
import { describe, it, expect } from 'vitest';
import {
  toWalletId,
  toPartyId,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type WalletAdapter,
} from '@partylayer/core';
import { createMockContext, checkNetworkTruthfulness } from './tests';

/** Base fixture adapter; subclasses decide what session.network they report. */
abstract class FixtureAdapter implements WalletAdapter {
  readonly walletId = toWalletId('fixture');
  readonly name = 'Fixture';
  getCapabilities(): CapabilityKey[] {
    return ['connect'];
  }
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true };
  }
  abstract connect(ctx: AdapterContext): Promise<AdapterConnectResult>;
  async disconnect(): Promise<void> {}
}

/** WRONG: echoes the requested ctx.network — fails the contract. */
class EchoAdapter extends FixtureAdapter {
  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    return {
      partyId: toPartyId('party::echo'),
      session: { walletId: this.walletId, network: ctx.network, createdAt: 0 },
      capabilities: ['connect'],
    };
  }
}

/** RIGHT: reports the wallet's actual network — passes the contract. */
class TruthfulAdapter extends FixtureAdapter {
  constructor(private readonly walletNetwork: string) {
    super();
  }
  async connect(): Promise<AdapterConnectResult> {
    return {
      partyId: toPartyId('party::truth'),
      session: { walletId: this.walletId, network: this.walletNetwork, createdAt: 0 },
      capabilities: ['connect'],
    };
  }
}

describe('conformance: network-truthfulness contract', () => {
  // The wallet is on mainnet; the dApp requested devnet.
  const ctx = (): AdapterContext => ({ ...createMockContext(), network: 'devnet' });
  const WALLET_NETWORK = 'canton:da-mainnet';

  it('FAILS an adapter that echoes ctx.network', async () => {
    const result = await checkNetworkTruthfulness(new EchoAdapter(), ctx(), WALLET_NETWORK);
    expect(result.passed).toBe(false);
    expect(result.error).toMatch(/echoed context\.network/);
  });

  it('PASSES an adapter that reports the wallet network', async () => {
    const result = await checkNetworkTruthfulness(new TruthfulAdapter(WALLET_NETWORK), ctx(), WALLET_NETWORK);
    expect(result.passed).toBe(true);
    expect(result.details).toMatchObject({ expected: WALLET_NETWORK, got: WALLET_NETWORK });
  });
});
