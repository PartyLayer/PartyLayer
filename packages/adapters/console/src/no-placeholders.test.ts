/**
 * Console adapter: no invented values.
 *
 * Three sites in this adapter used to manufacture data when the wallet gave it
 * none — a `party-<now>` party id at connect, and a `tx_<now>_<random>` string
 * standing in for a transaction hash on both signing paths. The signTransaction
 * one was not even a fallback: it ran on every call.
 *
 * The contract now is that the adapter reports what the wallet reported, or
 * fails. It never fills a gap with something that looks like an answer.
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
        /no party id/i,
      );
    });

    it('uses the wallet-reported party id when there is one', async () => {
      mockConsoleWallet.getPrimaryAccount.mockResolvedValue({ partyId: 'party::real' });

      const result = await new ConsoleAdapter({ target: 'local' }).connect(ctx());

      expect(String(result.partyId)).toBe('party::real');
      expect(String(result.partyId)).not.toMatch(FABRICATED);
    });
  });

  describe('signTransaction', () => {
    it('reports the wallet signature instead of a generated hash', async () => {
      // Previously this call ALWAYS produced `tx_<now>_<random>`, whatever the
      // wallet returned — a fabrication on the happy path, not an edge case.
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true, signature: 'sig-real' });

      const signed = await new ConsoleAdapter().signTransaction(ctx(), session(), {
        tx: { commands: [] },
      });

      expect(String(signed.transactionHash)).toBe('sig-real');
      expect(String(signed.transactionHash)).not.toMatch(FABRICATED);
    });

    it('fails when the wallet returns no signature', async () => {
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true });

      await expect(
        new ConsoleAdapter().signTransaction(ctx(), session(), { tx: { commands: [] } }),
      ).rejects.toThrow(/no signature/i);
    });
  });

  describe('submitTransaction', () => {
    it('reports the wallet signature', async () => {
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true, signature: 'sig-submit' });

      const receipt = await new ConsoleAdapter().submitTransaction(ctx(), session(), {
        signedTx: { commands: [] },
      });

      expect(String(receipt.transactionHash)).toBe('sig-submit');
    });

    it('fails when the wallet returns no signature', async () => {
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true });

      await expect(
        new ConsoleAdapter().submitTransaction(ctx(), session(), { signedTx: { commands: [] } }),
      ).rejects.toThrow(/no signature/i);
    });

    it('does not treat an empty-string signature as a value', async () => {
      // The studio site returned '' as a transactionHash. An empty string is
      // present, well-typed and falsy — it survives a null check while carrying
      // nothing, which is why it is treated as absent here.
      mockConsoleWallet.submitCommands.mockResolvedValue({ status: true, signature: '' });

      await expect(
        new ConsoleAdapter().submitTransaction(ctx(), session(), { signedTx: { commands: [] } }),
      ).rejects.toThrow(/no signature/i);
    });
  });
});
