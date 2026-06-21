/**
 * Nightly adapter unit tests.
 *
 * Nightly injects a CUSTOM, non-CIP-0103 provider at `window.nightly.canton`
 * with a callback-based signing API (see docs/wallet-cip0103-matrix.md and
 * https://docs.nightly.app/docs/canton/canton/connect/). These tests mock
 * that injected interface — no live wallet is involved — and pin:
 *   - detectInstalled (present / absent / no-window)
 *   - connect (success + not-installed)
 *   - signMessage callback handling (approved / rejected / error)
 *   - signTransaction → CapabilityNotSupportedError (sign+submit are fused)
 *   - submitTransaction callback handling (approved / rejected / error)
 *   - restore (connected / disconnected / expired)
 *   - ledgerApi runtime-probe (ledgerApi method / request method / neither)
 *   - the declared capability set, and the capabilities it cannot satisfy
 *
 * window globals are installed via vi.stubGlobal, mirroring the Send adapter's
 * test harness (the repo's vitest environment is 'node', so there is no window
 * by default).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CapabilityNotSupportedError,
  TransportError,
  UserRejectedError,
  WalletNotInstalledError,
  toPartyId,
  toSessionId,
  toWalletId,
  type AdapterContext,
  type CapabilityKey,
  type Session,
} from '@partylayer/core';
import { NightlyAdapter } from './nightly-adapter';

// ── Test harness ─────────────────────────────────────────────────────────────

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.com',
    network: 'devnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
      }),
  };
}

function createMockSession(): Session {
  return {
    sessionId: toSessionId('test-session'),
    walletId: toWalletId('nightly'),
    partyId: toPartyId('party::test'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.com',
    capabilitiesSnapshot: ['connect', 'signMessage'] as CapabilityKey[],
  };
}

type SignResponse =
  | { type: 'sign_request_approved'; data: { signature?: string; updateId?: string } }
  | { type: 'sign_request_rejected'; data: { reason: string } }
  | { type: 'sign_request_error'; data: { error: string } };

interface MockNightlyProvider {
  partyId: string;
  publicKey: string;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
  signMessage: ReturnType<typeof vi.fn>;
  createTransferCommand: ReturnType<typeof vi.fn>;
  submitTransactionCommand: ReturnType<typeof vi.fn>;
  getPendingTransactions: ReturnType<typeof vi.fn>;
  getHoldingUtxos: ReturnType<typeof vi.fn>;
  ledgerApi?: ReturnType<typeof vi.fn>;
  request?: ReturnType<typeof vi.fn>;
}

/**
 * Build a mock of the injected `window.nightly.canton` provider. `signResponse`
 * / `submitResponse` drive the callback the adapter wraps in a Promise.
 */
function createNightlyProvider(
  overrides: Partial<MockNightlyProvider> & {
    signResponse?: SignResponse;
    submitResponse?: SignResponse;
    connected?: boolean;
  } = {},
): MockNightlyProvider {
  const { signResponse, submitResponse, connected = true, ...rest } = overrides;
  return {
    partyId: 'party::nightly-abc',
    publicKey: 'pubkey-nightly-xyz',
    connect: vi.fn(async () => ({ partyId: 'party::nightly-abc', publicKey: 'pubkey-nightly-xyz' })),
    disconnect: vi.fn(async () => {}),
    isConnected: vi.fn(() => connected),
    signMessage: vi.fn((_message: string, onResponse: (r: SignResponse) => void) => {
      onResponse(
        signResponse ?? { type: 'sign_request_approved', data: { signature: 'nightly-sig' } },
      );
    }),
    createTransferCommand: vi.fn(async () => ({ command: {}, disclosedContracts: [] })),
    submitTransactionCommand: vi.fn(
      (_cmd: unknown, onResponse: (r: SignResponse) => void) => {
        onResponse(
          submitResponse ?? { type: 'sign_request_approved', data: { updateId: 'update-1' } },
        );
      },
    ),
    getPendingTransactions: vi.fn(async () => []),
    getHoldingUtxos: vi.fn(async () => []),
    ...rest,
  };
}

function installNightly(provider: MockNightlyProvider): void {
  vi.stubGlobal('window', { nightly: { canton: provider } });
}

describe('NightlyAdapter', () => {
  let adapter: NightlyAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new NightlyAdapter();
    ctx = createMockContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── identity + capabilities ────────────────────────────────────────────────

  describe('identity & capabilities', () => {
    it('has the correct walletId and name', () => {
      expect(adapter.walletId).toBe(toWalletId('nightly'));
      expect(adapter.name).toBe('Nightly');
    });

    it('declares the expected capability set', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toEqual(
        expect.arrayContaining([
          'connect',
          'disconnect',
          'restore',
          'signMessage',
          'submitTransaction',
          'ledgerApi',
          'events',
          'injected',
        ]),
      );
    });

    it('does NOT advertise signTransaction (Nightly fuses sign+submit)', () => {
      expect(adapter.getCapabilities()).not.toContain('signTransaction');
    });
  });

  // ── detectInstalled ────────────────────────────────────────────────────────

  describe('detectInstalled', () => {
    it('returns false when there is no window (non-browser)', async () => {
      // No stubGlobal — window is undefined in the node test env.
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toMatch(/browser/i);
    });

    it('returns false when window exists but window.nightly.canton is absent', async () => {
      vi.stubGlobal('window', {});
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toMatch(/not detected/i);
    });

    it('returns true when window.nightly.canton is present', async () => {
      installNightly(createNightlyProvider());
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(true);
      expect(result.reason).toMatch(/detected/i);
    });
  });

  // ── connect ──────────────────────────────────────────────────────────────

  describe('connect', () => {
    it('connects, returns partyId + publicKey metadata + capabilities', async () => {
      const provider = createNightlyProvider();
      installNightly(provider);

      const result = await adapter.connect(ctx);

      expect(provider.connect).toHaveBeenCalledTimes(1);
      expect(result.partyId).toBe(toPartyId('party::nightly-abc'));
      expect(result.session.walletId).toBe(toWalletId('nightly'));
      expect(result.session.network).toBe('devnet');
      expect(result.session.metadata?.publicKey).toBe('pubkey-nightly-xyz');
      expect(result.capabilities).toEqual(adapter.getCapabilities());
    });

    it('throws WalletNotInstalledError when the provider is absent', async () => {
      vi.stubGlobal('window', {});
      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(WalletNotInstalledError);
    });

    it('maps a user-rejected connect() to UserRejectedError', async () => {
      const provider = createNightlyProvider({
        connect: vi.fn(async () => {
          throw new Error('User rejected the connection');
        }),
      });
      installNightly(provider);
      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(UserRejectedError);
    });
  });

  // ── signMessage (callback-based) ───────────────────────────────────────────

  describe('signMessage (callback handling)', () => {
    async function connectedAdapter(
      overrides: Parameters<typeof createNightlyProvider>[0] = {},
    ): Promise<MockNightlyProvider> {
      const provider = createNightlyProvider(overrides);
      installNightly(provider);
      await adapter.connect(ctx);
      return provider;
    }

    it('resolves with the signature on sign_request_approved', async () => {
      await connectedAdapter({
        signResponse: { type: 'sign_request_approved', data: { signature: 'approved-sig' } },
      });
      const result = await adapter.signMessage(ctx, createMockSession(), { message: 'hello' });
      expect(String(result.signature)).toBe('approved-sig');
      expect(result.message).toBe('hello');
    });

    it('rejects (UserRejectedError) on sign_request_rejected', async () => {
      await connectedAdapter({
        signResponse: { type: 'sign_request_rejected', data: { reason: 'user said no' } },
      });
      await expect(
        adapter.signMessage(ctx, createMockSession(), { message: 'hi' }),
      ).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('rejects (TransportError) on sign_request_error', async () => {
      await connectedAdapter({
        signResponse: { type: 'sign_request_error', data: { error: 'internal failure' } },
      });
      await expect(
        adapter.signMessage(ctx, createMockSession(), { message: 'hi' }),
      ).rejects.toBeInstanceOf(TransportError);
    });

    it('rejects when called before connect (no wallet bound)', async () => {
      installNightly(createNightlyProvider());
      // note: no connect() call, so adapter.wallet is null
      await expect(
        adapter.signMessage(ctx, createMockSession(), { message: 'hi' }),
      ).rejects.toThrow();
    });
  });

  // ── signTransaction (unsupported) ──────────────────────────────────────────

  describe('signTransaction', () => {
    it('throws CapabilityNotSupportedError (sign+submit are fused)', async () => {
      installNightly(createNightlyProvider());
      await adapter.connect(ctx);
      await expect(
        adapter.signTransaction(ctx, createMockSession(), { tx: {} }),
      ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    });
  });

  // ── submitTransaction (callback-based) ─────────────────────────────────────

  describe('submitTransaction (callback handling)', () => {
    async function connectedAdapter(
      overrides: Parameters<typeof createNightlyProvider>[0] = {},
    ): Promise<MockNightlyProvider> {
      const provider = createNightlyProvider(overrides);
      installNightly(provider);
      await adapter.connect(ctx);
      return provider;
    }

    it('uses updateId as the transaction hash on approval', async () => {
      await connectedAdapter({
        submitResponse: { type: 'sign_request_approved', data: { updateId: 'update-42' } },
      });
      const receipt = await adapter.submitTransaction(ctx, createMockSession(), {
        signedTx: { command: {}, disclosedContracts: [] },
      });
      expect(String(receipt.transactionHash)).toBe('update-42');
      expect(typeof receipt.submittedAt).toBe('number');
    });

    it('falls back to signature as the hash when updateId is absent', async () => {
      await connectedAdapter({
        submitResponse: { type: 'sign_request_approved', data: { signature: 'sig-99' } },
      });
      const receipt = await adapter.submitTransaction(ctx, createMockSession(), {
        signedTx: { command: {}, disclosedContracts: [] },
      });
      expect(String(receipt.transactionHash)).toBe('sig-99');
    });

    it('rejects (UserRejectedError) on sign_request_rejected', async () => {
      await connectedAdapter({
        submitResponse: { type: 'sign_request_rejected', data: { reason: 'declined' } },
      });
      await expect(
        adapter.submitTransaction(ctx, createMockSession(), { signedTx: {} }),
      ).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('rejects (TransportError) on sign_request_error', async () => {
      await connectedAdapter({
        submitResponse: { type: 'sign_request_error', data: { error: 'broker down' } },
      });
      await expect(
        adapter.submitTransaction(ctx, createMockSession(), { signedTx: {} }),
      ).rejects.toBeInstanceOf(TransportError);
    });

    it('rejects when called before connect', async () => {
      installNightly(createNightlyProvider());
      await expect(
        adapter.submitTransaction(ctx, createMockSession(), { signedTx: {} }),
      ).rejects.toThrow();
    });
  });

  // ── restore ────────────────────────────────────────────────────────────────

  describe('restore', () => {
    it('returns the session when the provider reports connected', async () => {
      installNightly(createNightlyProvider({ connected: true }));
      const persisted = { ...createMockSession() };
      const restored = await adapter.restore(ctx, persisted);
      expect(restored).not.toBeNull();
      expect(restored?.walletId).toBe(toWalletId('nightly'));
    });

    it('returns null when the provider reports NOT connected', async () => {
      installNightly(createNightlyProvider({ connected: false }));
      const restored = await adapter.restore(ctx, createMockSession());
      expect(restored).toBeNull();
    });

    it('returns null when the provider is absent', async () => {
      vi.stubGlobal('window', {});
      const restored = await adapter.restore(ctx, createMockSession());
      expect(restored).toBeNull();
    });

    it('returns null for an expired session', async () => {
      installNightly(createNightlyProvider({ connected: true }));
      const expired = { ...createMockSession(), expiresAt: Date.now() - 1000 };
      const restored = await adapter.restore(ctx, expired);
      expect(restored).toBeNull();
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('calls provider.disconnect()', async () => {
      const provider = createNightlyProvider();
      installNightly(provider);
      await adapter.connect(ctx);
      await adapter.disconnect(ctx, createMockSession());
      expect(provider.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  // ── ledgerApi (runtime CIP-0103 probe) ─────────────────────────────────────

  describe('ledgerApi (opportunistic CIP-0103 probe)', () => {
    const params = { requestMethod: 'GET', resource: '/v2/state/acs' };

    it('uses provider.ledgerApi when present', async () => {
      const provider = createNightlyProvider({
        ledgerApi: vi.fn(async () => ({ response: 'acs-data' })),
      });
      installNightly(provider);
      const result = await adapter.ledgerApi(ctx, createMockSession(), params);
      expect(provider.ledgerApi).toHaveBeenCalled();
      expect(result.response).toBe('acs-data');
    });

    it('normalizes to CIP-0103 on the wire: lower-case verb + OBJECT body', async () => {
      const provider = createNightlyProvider({
        ledgerApi: vi.fn(async () => ({ response: 'ok' })),
      });
      installNightly(provider);
      await adapter.ledgerApi(ctx, createMockSession(), {
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: '{"filter":{"x":1}}',
      });
      expect(provider.ledgerApi).toHaveBeenCalledWith({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: { filter: { x: 1 } },
      });
    });

    it('falls back to provider.request when ledgerApi is absent', async () => {
      const provider = createNightlyProvider({
        request: vi.fn(async () => ({ response: 'via-request' })),
      });
      installNightly(provider);
      const result = await adapter.ledgerApi(ctx, createMockSession(), params);
      expect(provider.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'ledgerApi' }),
      );
      expect(result.response).toBe('via-request');
    });

    it('throws CapabilityNotSupportedError when neither ledgerApi nor request exists', async () => {
      installNightly(createNightlyProvider());
      await expect(
        adapter.ledgerApi(ctx, createMockSession(), params),
      ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    });
  });
});
