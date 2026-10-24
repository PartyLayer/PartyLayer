import { describe, expect, it, vi } from 'vitest';
import { OneSwapCip0103Provider, type OneSwapWalletClient } from '@oneswap/wallet-cip0103-adapter';
import type { AdapterContext, OfficialProviderAdapter, Session } from '@partylayer/core';
import { GenericDiscoveryAdapter } from './discovery-adapter';

// Exercise the actual pinned vendor provider. Only the popup transport is fake;
// this is protocol interoperability evidence, not a live wallet/ledger test.
describe('published OneSwap 0.2.0 provider interoperability', () => {
  it('connects, signs, executes once through the supported verb, and disconnects', async () => {
    const popup = {
      connect: vi.fn(async () => ({ primaryAccount: { partyId: 'party::oneswap', publicKey: 'pk', network: 'devnet' } })),
      signMessage: vi.fn(async () => ({ signature: 'vendor-signature', partyId: 'party::oneswap', publicKey: 'pk', encoding: 'utf8' })),
      prepareSignExecute: vi.fn(async () => ({ transactionHash: 'ledger-update', updateId: 'ledger-update', submittedAt: '2026-10-23T12:00:00Z' })),
      disconnect: vi.fn(async () => undefined),
    };
    const provider = new OneSwapCip0103Provider(popup as unknown as OneSwapWalletClient, 'canton:da-devnet', 'oneswap');
    const adapter = new GenericDiscoveryAdapter({ official: {
      providerId: 'oneswap', name: 'OneSwap', detect: async () => true, provider: () => provider,
    } as unknown as OfficialProviderAdapter });
    const ctx = { network: 'devnet' } as AdapterContext;
    const result = await adapter.connect(ctx);
    const session = result.session as Session;
    expect(result.partyId).toBe('party::oneswap');
    expect(await adapter.signMessage(ctx, session, { message: 'Hello Canton — test' })).toEqual({
      signature: 'vendor-signature', partyId: 'party::oneswap', message: 'Hello Canton — test',
    });
    const commands = [{ ExerciseCommand: { templateId: 'pkg:Module:Token', contractId: 'test-contract', choice: 'Test', choiceArgument: {} } }];
    const receipt = await adapter.submitTransaction(ctx, session, { signedTx: { commands } });
    expect(popup.prepareSignExecute).toHaveBeenCalledTimes(1);
    expect(popup.prepareSignExecute).toHaveBeenCalledWith(commands);
    expect(receipt).toEqual({ transactionHash: 'ledger-update', updateId: 'ledger-update', submittedAt: Date.parse('2026-10-23T12:00:00Z') });
    await adapter.disconnect();
    expect(popup.disconnect).toHaveBeenCalledTimes(1);
  });
});
