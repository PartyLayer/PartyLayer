/**
 * Console adapter: requestTransfer.
 *
 * What matters here is the contract, not the plumbing:
 *   - the intent maps onto Console's typed sign-and-send, with the acting party
 *     taken from the SESSION and never from the caller;
 *   - the update id comes from the txChanged stream and is real, or the call
 *     throws — never a command id, a signature, or a generated string;
 *   - a user rejection is an error, not a silent success;
 *   - fields Console cannot carry are refused, not dropped.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleAdapter } from './console-adapter';
import type { AdapterContext, Session, TransferIntent } from '@partylayer/core';
import { toPartyId, toSessionId, toWalletId } from '@partylayer/core';

const mockConsoleWallet = vi.hoisted(() => ({
  checkExtensionAvailability: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  getPrimaryAccount: vi.fn(),
  getActiveNetwork: vi.fn(),
  status: vi.fn(),
  signMessage: vi.fn(),
  submitCommands: vi.fn(),
  ledgerApi: vi.fn(),
  onConnectionStatusChanged: vi.fn(),
  onTxStatusChanged: vi.fn(),
}));

vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: mockConsoleWallet }));

/** Emit into whatever handler the adapter installed on the txChanged stream. */
let emitTx: (event: unknown) => void = () => {};

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
    walletId: toWalletId('console'),
    partyId: toPartyId('party::alice'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.example.com',
    capabilitiesSnapshot: ['connect', 'transfer'],
  };
}

const INTENT: TransferIntent = {
  receiver: 'party::bob',
  amount: '10.5',
  instrumentId: { admin: 'party::registry', id: 'CC' },
  executeBefore: '2026-12-31T23:59:59Z',
};

describe('ConsoleAdapter.requestTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWallet.onTxStatusChanged.mockImplementation((cb: (e: unknown) => void) => {
      emitTx = cb;
    });
  });

  it('declares the transfer capability', () => {
    expect(new ConsoleAdapter().getCapabilities()).toContain('transfer');
  });

  it('returns the real update id from the executed event', async () => {
    mockConsoleWallet.submitCommands.mockImplementation(async () => {
      // The wallet signs, then executes; both arrive on the shared stream.
      queueMicrotask(() => {
        emitTx({ status: 'signed', commandId: 'cmd-9', payload: { signature: 'sig-abc' } });
        emitTx({
          status: 'executed',
          commandId: 'cmd-9',
          payload: { updateId: 'update-real-1', completionOffset: 77 },
        });
      });
      return { status: true, signature: 'sig-abc' };
    });

    const result = await new ConsoleAdapter().requestTransfer(ctx(), session(), INTENT);

    expect(result.updateId).toBe('update-real-1');
    expect(result.commandId).toBe('cmd-9');
    expect(result.completionOffset).toBe(77);
    expect(String(result.partyId)).toBe('party::alice');
  });

  it('sends the session party as the sender, and the intent fields as the transfer', async () => {
    mockConsoleWallet.submitCommands.mockImplementation(async () => {
      queueMicrotask(() => {
        emitTx({ status: 'signed', commandId: 'c1', payload: { signature: 's1' } });
        emitTx({ status: 'executed', commandId: 'c1', payload: { updateId: 'u1' } });
      });
      return { status: true, signature: 's1' };
    });

    await new ConsoleAdapter().requestTransfer(ctx(), session(), {
      ...INTENT,
      meta: { memo: 'invoice-7' },
    });

    expect(mockConsoleWallet.submitCommands).toHaveBeenCalledWith({
      from: 'party::alice',
      to: 'party::bob',
      token: 'CC',
      amount: '10.5',
      expireDate: '2026-12-31T23:59:59Z',
      memo: 'invoice-7',
    });
  });

  it('does not forward a caller-supplied option to the wallet', async () => {
    mockConsoleWallet.submitCommands.mockImplementation(async () => {
      queueMicrotask(() => {
        emitTx({ status: 'signed', commandId: 'c1', payload: { signature: 's1' } });
        emitTx({ status: 'executed', commandId: 'c1', payload: { updateId: 'u1' } });
      });
      return { status: true, signature: 's1' };
    });

    await new ConsoleAdapter().requestTransfer(ctx(), session(), {
      ...INTENT,
      skipConfirmation: true,
      waitForFinalization: 0,
      from: 'party::mallory',
    } as unknown as TransferIntent);

    const sent = mockConsoleWallet.submitCommands.mock.calls[0][0];
    expect(sent).not.toHaveProperty('skipConfirmation');
    expect(sent).not.toHaveProperty('waitForFinalization');
    // `from` survives as a key, but only ever holds the session party.
    expect(sent.from).toBe('party::alice');
  });

  describe('real values or an error', () => {
    it('throws when the user does not approve', async () => {
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: false });

      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), INTENT),
      ).rejects.toThrow(/did not approve/);
    });

    it('throws when the transfer fails, rather than returning a placeholder', async () => {
      mockConsoleWallet.submitCommands.mockImplementation(async () => {
        queueMicrotask(() => {
          emitTx({ status: 'signed', commandId: 'c2', payload: { signature: 's2' } });
          emitTx({ status: 'failed', commandId: 'c2' });
        });
        return { status: true, signature: 's2' };
      });

      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), INTENT),
      ).rejects.toThrow(/failed/);
    });

    it('throws when the executed event carries no update id', async () => {
      mockConsoleWallet.submitCommands.mockImplementation(async () => {
        queueMicrotask(() => {
          emitTx({ status: 'signed', commandId: 'c3', payload: { signature: 's3' } });
          emitTx({ status: 'executed', commandId: 'c3', payload: {} });
        });
        return { status: true, signature: 's3' };
      });

      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), INTENT),
      ).rejects.toThrow(/no update id/);
    });

    it('refuses to guess when two transfers are in flight and the signature does not match', async () => {
      mockConsoleWallet.submitCommands.mockImplementation(async () => {
        queueMicrotask(() => {
          emitTx({ status: 'signed', commandId: 'c-other-1', payload: { signature: 'x' } });
          emitTx({ status: 'signed', commandId: 'c-other-2', payload: { signature: 'y' } });
        });
        return { status: true, signature: 'no-such-signature' };
      });

      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), INTENT),
      ).rejects.toThrow(/command id/);
    });
  });

  describe('fields Console cannot carry are refused, not dropped', () => {
    it('refuses an intent with no deadline rather than inventing one', async () => {
      const { executeBefore: _drop, ...noDeadline } = INTENT;

      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), noDeadline as TransferIntent),
      ).rejects.toThrow(/executeBefore/);
      expect(mockConsoleWallet.submitCommands).not.toHaveBeenCalled();
    });

    it('refuses a metadata map it cannot represent as a single memo', async () => {
      await expect(
        new ConsoleAdapter().requestTransfer(ctx(), session(), {
          ...INTENT,
          meta: { ref: 'a', note: 'b' },
        }),
      ).rejects.toThrow(/single "memo" string/);
      expect(mockConsoleWallet.submitCommands).not.toHaveBeenCalled();
    });
  });

  it('subscribes to the txChanged stream once across many transfers', async () => {
    mockConsoleWallet.submitCommands.mockImplementation(async () => {
      queueMicrotask(() => {
        emitTx({ status: 'signed', commandId: 'c1', payload: { signature: 's1' } });
        emitTx({ status: 'executed', commandId: 'c1', payload: { updateId: 'u1' } });
      });
      return { status: true, signature: 's1' };
    });

    // The SDK's onTxStatusChanged adds a window listener and returns no
    // unsubscribe, so a per-call subscription would leak one listener per
    // transfer.
    const adapter = new ConsoleAdapter();
    await adapter.requestTransfer(ctx(), session(), INTENT);
    await adapter.requestTransfer(ctx(), session(), INTENT);
    await adapter.requestTransfer(ctx(), session(), INTENT);

    expect(mockConsoleWallet.onTxStatusChanged).toHaveBeenCalledTimes(1);
  });
});
