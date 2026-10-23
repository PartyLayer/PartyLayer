/**
 * Console adapter: no invented values.
 *
 * Three sites in this adapter used to manufacture data when the wallet gave it
 * none — a `party-<now>` party id at connect, and a `tx_<now>_<random>` string
 * standing in for a transaction hash on both signing paths. The signTransaction
 * one was not even a fallback: it ran on every call.
 *
 * Successful submission acknowledgements may carry no ledger identifier.
 * Sign-only requests must never call the vendor's combined sign-and-send API.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleAdapter } from './console-adapter';
import type { AdapterContext, Session } from '@partylayer/core';
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
    capabilitiesSnapshot: ['connect'],
  };
}

/** Anything that looks manufactured rather than reported. */
const FABRICATED = /^(tx_|party-)\d/;

describe('ConsoleAdapter invents nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({ status: 'installed' });
    mockConsoleWallet.connect.mockResolvedValue({ isConnected: true });
    mockConsoleWallet.getActiveNetwork.mockResolvedValue({ networkId: 'canton:da-devnet' });
  });

  describe('connect', () => {
    it('fails when the wallet reports no party id, rather than generating one', async () => {
      // A session carrying a fabricated party is not degraded, it is broken:
      // every later call would act as a party that does not exist.
      mockConsoleWallet.getPrimaryAccount.mockResolvedValue({ partyId: undefined });

      await expect(new ConsoleAdapter({ target: 'local' }).connect(ctx())).rejects.toThrow(
        /no party id/i
      );
    });

    it('uses the wallet-reported party id when there is one', async () => {
      mockConsoleWallet.getPrimaryAccount.mockResolvedValue({ partyId: 'party::real' });

      const result = await new ConsoleAdapter({ target: 'local' }).connect(ctx());

      expect(String(result.partyId)).toBe('party::real');
      expect(String(result.partyId)).not.toMatch(FABRICATED);
    });
  });

  describe('signMessage', () => {
    it.each([undefined, '', '   ', { signature: {} }, { signature: 123 }])(
      'rejects malformed signatures without coercing them to strings: %j', async (reply) => {
        mockConsoleWallet.signMessage.mockResolvedValue(reply);
        await expect(
          new ConsoleAdapter().signMessage(ctx(), session(), { message: 'Hello Canton' }),
        ).rejects.toThrow(/invalid message signature/i);
      },
    );
  });

  describe('signTransaction', () => {
    it('never calls the combined sign-and-send API for a sign-only request', async () => {
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true, signature: 'sig-real' });
      await expect(
        new ConsoleAdapter().signTransaction(ctx(), session(), { tx: { commands: [] } })
      ).rejects.toThrow(/signTransaction/i);
      expect(mockConsoleWallet.submitCommands).not.toHaveBeenCalled();
    });
  });

  describe('submitTransaction', () => {
    it.each([
      { status: true, signature: 'sig-submit' },
      { status: true },
      { status: true, signature: '' },
    ])('returns an acknowledgement without inventing a ledger hash: %j', async (reply) => {
      mockConsoleWallet.submitCommands.mockResolvedValue(reply);
      const receipt = await new ConsoleAdapter().submitTransaction(ctx(), session(), {
        signedTx: { commands: [] },
      });
      expect(receipt.submittedAt).toBeGreaterThan(0);
      expect(receipt.transactionHash).toBeUndefined();
      expect(receipt.updateId).toBeUndefined();
    });

    it.each([undefined, null, {}, { status: false, signature: 'sig-rejected' }])(
      'rejects unsuccessful or missing acknowledgements: %j',
      async (reply) => {
        mockConsoleWallet.submitCommands.mockResolvedValue(reply);
        await expect(
          new ConsoleAdapter().submitTransaction(ctx(), session(), { signedTx: { commands: [] } })
        ).rejects.toThrow(/no successful submission acknowledgement/i);
      }
    );
  });
});
