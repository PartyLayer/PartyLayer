/**
 * client.requestTransfer: the typed transfer path at the SDK boundary.
 *
 * The core-level allowlist is pinned in @partylayer/core's transfer.test.ts.
 * What THIS suite pins is that the client actually applies it, and applies it
 * BEFORE the adapter is called — so an adapter (and therefore a wallet) can
 * never observe a caller-supplied option, whatever the adapter does with what it
 * is handed.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  toPartyId,
  toWalletId,
  toSessionId,
  CapabilityNotSupportedError,
  type Session,
  type TransferIntent,
  type TransferResult,
  type WalletAdapter,
} from '@partylayer/core';
import { createPartyLayer } from './client';

function makeSession(walletId: string): Session {
  return {
    sessionId: toSessionId('sess-1'),
    walletId: toWalletId(walletId),
    partyId: toPartyId('party::alice'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.example.com',
    capabilitiesSnapshot: ['connect', 'transfer'],
  };
}

/** A client with `adapter` registered and an active session already in place. */
function makeClient(adapter: WalletAdapter) {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'transfer-test', origin: 'https://test.example.com' },
    discovery: { announceTimeoutMs: 0 },
    adapters: [],
    storage: {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
      clear: async () => {},
    } as never,
    crypto: {
      encrypt: async (d: unknown) => d,
      decrypt: async (d: unknown) => d,
      generateKey: async () => 'k',
    } as never,
  });
  client.registerAdapter(adapter);
  vi.spyOn(client, 'getActiveSession').mockResolvedValue(makeSession(adapter.walletId));
  return client;
}

/** A wallet adapter that records exactly what the client handed it. */
function recordingAdapter(walletId = 'recorder') {
  const seen: TransferIntent[] = [];
  const adapter: WalletAdapter = {
    walletId: toWalletId(walletId),
    name: 'Recorder',
    getCapabilities: () => ['connect', 'transfer'],
    detectInstalled: async () => ({ installed: true }),
    connect: async () => ({
      partyId: toPartyId('party::alice'),
      session: {},
      capabilities: ['connect', 'transfer'],
    }),
    disconnect: async () => {},
    requestTransfer: async (_ctx, session, intent): Promise<TransferResult> => {
      seen.push(intent);
      return {
        updateId: 'update-abc',
        commandId: 'cmd-1',
        completionOffset: 42,
        partyId: session.partyId,
      };
    },
  };
  return { adapter, seen };
}

const INTENT: TransferIntent = {
  receiver: 'party::bob',
  amount: '10.5',
  instrumentId: { admin: 'party::registry', id: 'CC' },
};

describe('client.requestTransfer', () => {
  it('returns the adapter result, including the real update id', async () => {
    const { adapter } = recordingAdapter();
    const result = await makeClient(adapter).requestTransfer(INTENT);

    expect(result.updateId).toBe('update-abc');
    expect(result.commandId).toBe('cmd-1');
    expect(result.completionOffset).toBe(42);
    expect(String(result.partyId)).toBe('party::alice');
  });

  it('throws CapabilityNotSupportedError when the wallet does not implement it', async () => {
    const { adapter } = recordingAdapter('no-transfer');
    delete (adapter as { requestTransfer?: unknown }).requestTransfer;

    await expect(makeClient(adapter).requestTransfer(INTENT)).rejects.toThrow(
      CapabilityNotSupportedError,
    );
  });

  describe('the adapter never sees a caller-supplied option', () => {
    it('strips an approval-suppressing flag before the adapter is called', async () => {
      const { adapter, seen } = recordingAdapter();
      await makeClient(adapter).requestTransfer({
        ...INTENT,
        skipConfirmation: true,
        autoApprove: true,
      } as unknown as TransferIntent);

      expect(seen).toHaveLength(1);
      expect(seen[0]).not.toHaveProperty('skipConfirmation');
      expect(seen[0]).not.toHaveProperty('autoApprove');
      expect(seen[0]).toEqual(INTENT);
    });

    it('strips a caller-supplied sender, so the acting party can only be the session party', async () => {
      const { adapter, seen } = recordingAdapter();
      const result = await makeClient(adapter).requestTransfer({
        ...INTENT,
        sender: 'party::mallory',
        actAs: ['party::mallory'],
      } as unknown as TransferIntent);

      expect(seen[0]).not.toHaveProperty('sender');
      expect(seen[0]).not.toHaveProperty('actAs');
      // The party on the result is the session's, not the one the caller asked for.
      expect(String(result.partyId)).toBe('party::alice');
    });

    it('strips caller-chosen holdings and raw commands', async () => {
      const { adapter, seen } = recordingAdapter();
      await makeClient(adapter).requestTransfer({
        ...INTENT,
        inputHoldingCids: ['cid::1'],
        commands: [{ CreateCommand: {} }],
      } as unknown as TransferIntent);

      expect(seen[0]).not.toHaveProperty('inputHoldingCids');
      expect(seen[0]).not.toHaveProperty('commands');
    });

    it('rejects a numeric amount before the adapter is called', async () => {
      const { adapter, seen } = recordingAdapter();
      await expect(
        makeClient(adapter).requestTransfer({
          ...INTENT,
          amount: 10.5,
        } as unknown as TransferIntent),
      ).rejects.toThrow(/decimal string, not a number/);

      // The adapter was never reached: a malformed intent stops at the boundary.
      expect(seen).toHaveLength(0);
    });
  });
});
