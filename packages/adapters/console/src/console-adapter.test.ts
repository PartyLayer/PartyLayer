/**
 * Console adapter tests
 *
 * Tests all three connection modes (local, remote, combined) and verifies
 * capabilities, detection, connect, restore, disconnect, signMessage,
 * and error context transport reporting.
 */

/**
 * Runs under jsdom (see this package's vitest.config.ts). The adapter's only DOM
 * dependency is `window.postMessage`; the wallet SDK is mocked below. These tests
 * were previously written as `it.skipIf(!isBrowser)` against a node environment,
 * so all 33 of them silently never ran while the suite reported green.
 *
 * The one case that genuinely needs `window` ABSENT lives in
 * `console-adapter.ssr.test.ts`, which pins its own environment with a docblock.
 * There is no environment conditional anywhere in this file, and `gate:test-skips`
 * fails the build if one comes back.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleAdapter } from './console-adapter';
import type { ConsoleAdapterConfig } from './console-adapter';
import type { AdapterContext, PersistedSession, Session } from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toSessionId,
} from '@partylayer/core';

// ---------------------------------------------------------------------------
// Mock the @console-wallet/dapp-sdk module
// vi.hoisted ensures the mock object is created before vi.mock hoists
// ---------------------------------------------------------------------------
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

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: mockConsoleWallet,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockContext(overrides?: Partial<AdapterContext>): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.com',
    network: 'devnet',
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registry: {
      getWallet: vi.fn(),
    },
    crypto: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
    },
    storage: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
      }),
    ...overrides,
  };
}

function createPersistedSession(
  overrides?: Partial<PersistedSession>,
): PersistedSession {
  return {
    sessionId: toSessionId('test-session-1'),
    walletId: toWalletId('console'),
    partyId: toPartyId('party::test'),
    network: 'devnet',
    createdAt: Date.now() - 60_000,
    origin: 'https://test.com',
    capabilitiesSnapshot: ['connect', 'disconnect', 'signMessage'],
    encrypted: 'encrypted-data',
    ...overrides,
  };
}

/** Set up mockConsoleWallet for a successful connect flow */
function setupSuccessfulConnect() {
  mockConsoleWallet.connect.mockResolvedValue({
    isConnected: true,
  });
  mockConsoleWallet.getPrimaryAccount.mockResolvedValue({
    partyId: 'party::test-user',
    primary: true,
    status: 'initialized',
  });
  mockConsoleWallet.getActiveNetwork.mockResolvedValue({
    id: 'devnet',
    name: 'DevNet',
  });
  mockConsoleWallet.status.mockResolvedValue({
    provider: {
      id: 'provider-1',
      providerType: 'validator',
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ConsoleAdapter', () => {
  let ctx: AdapterContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
  });

  // =========================================================================
  // Adapter properties
  // =========================================================================
  describe('adapter properties', () => {
    it('should have correct walletId', () => {
      const adapter = new ConsoleAdapter();
      expect(adapter.walletId).toBe(toWalletId('console'));
    });

    it('should have correct name', () => {
      const adapter = new ConsoleAdapter();
      expect(adapter.name).toBe('Console Wallet');
    });
  });

  // =========================================================================
  // Constructor / config
  // =========================================================================
  describe('constructor', () => {
    it('should default to combined target', () => {
      const adapter = new ConsoleAdapter();
      const caps = adapter.getCapabilities();
      // Combined mode includes both injected and deeplink/remoteSigner
      expect(caps).toContain('injected');
      expect(caps).toContain('deeplink');
      expect(caps).toContain('remoteSigner');
    });

    it('should accept explicit target config', () => {
      const adapter = new ConsoleAdapter({ target: 'remote' });
      const caps = adapter.getCapabilities();
      expect(caps).toContain('deeplink');
      expect(caps).toContain('remoteSigner');
      expect(caps).not.toContain('injected');
    });
  });

  // =========================================================================
  // getCapabilities()
  // =========================================================================
  describe('getCapabilities', () => {
    it('local: should include injected, exclude deeplink/remoteSigner', () => {
      const adapter = new ConsoleAdapter({ target: 'local' });
      const caps = adapter.getCapabilities();
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('restore');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('signTransaction');
      expect(caps).toContain('submitTransaction');
      expect(caps).toContain('ledgerApi');
      expect(caps).toContain('events');
      expect(caps).toContain('injected');
      expect(caps).not.toContain('deeplink');
      expect(caps).not.toContain('remoteSigner');
    });

    it('remote: should include deeplink+remoteSigner, exclude injected', () => {
      const adapter = new ConsoleAdapter({ target: 'remote' });
      const caps = adapter.getCapabilities();
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('deeplink');
      expect(caps).toContain('remoteSigner');
      expect(caps).not.toContain('injected');
    });

    it('combined: should include injected, deeplink, and remoteSigner', () => {
      const adapter = new ConsoleAdapter({ target: 'combined' });
      const caps = adapter.getCapabilities();
      expect(caps).toContain('injected');
      expect(caps).toContain('deeplink');
      expect(caps).toContain('remoteSigner');
    });

    it('default (no config): should behave as combined', () => {
      const adapter = new ConsoleAdapter();
      const caps = adapter.getCapabilities();
      expect(caps).toContain('injected');
      expect(caps).toContain('deeplink');
      expect(caps).toContain('remoteSigner');
    });
  });

  // =========================================================================
  // detectInstalled()
  // =========================================================================
  describe('detectInstalled', () => {
    it(
      'local: should check extension availability',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
          currentVersion: '2.1.5',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(true);
        expect(result.reason).toContain('v2.1.5');
        expect(mockConsoleWallet.checkExtensionAvailability).toHaveBeenCalled();
      },
    );

    it(
      'local: should return false if extension not found',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(false);
        expect(result.reason).toContain('not detected');
      },
    );

    it(
      'local: should handle extension timeout gracefully',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockRejectedValue(
          new Error('Timeout'),
        );

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(false);
        expect(result.reason).toContain('not responding');
      },
    );

    it(
      'remote: should return installed=false (no local install to detect)',
      async () => {
        // Detection contract: detectInstalled() answers "is the local
        // install present?", not "is the wallet reachable?". 'remote'
        // target has no local install — the connect() flow handles QR /
        // deep-link reachability when invoked.
        const adapter = new ConsoleAdapter({ target: 'remote' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(false);
        expect(result.reason).toMatch(/no local install|connect/i);
        // remote target shouldn't probe the extension at detection time
        expect(
          mockConsoleWallet.checkExtensionAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'combined: should return installed=false when extension is absent',
      async () => {
        // Truthful detection: combined mode's primary medium is the
        // extension. When absent, detectInstalled reports false even
        // though connect() can fall back to QR. Anchors the green-dot /
        // grey-dot UX semantics in the picker.
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(false);
        expect(result.reason).toMatch(/extension/i);
      },
    );

    it(
      'combined: should report extension version when available',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
          currentVersion: '2.1.5',
        });

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(true);
        expect(result.reason).toContain('v2.1.5');
      },
    );
  });

  // =========================================================================
  // connect()
  // =========================================================================
  describe('connect', () => {
    it(
      'local: should pass target=local to SDK',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.connect(ctx);

        expect(mockConsoleWallet.connect).toHaveBeenCalledWith(
          expect.objectContaining({ target: 'local' }),
        );
        expect(result.partyId).toBe(toPartyId('party::test-user'));
        expect(result.session.metadata?.transport).toBe('injected');
      },
    );

    it(
      'local: should throw WalletNotInstalledError if extension absent',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        await expect(adapter.connect(ctx)).rejects.toThrow();
      },
    );

    it(
      'remote: should pass target=remote to SDK',
      async () => {
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'remote' });
        const result = await adapter.connect(ctx);

        expect(mockConsoleWallet.connect).toHaveBeenCalledWith(
          expect.objectContaining({ target: 'remote' }),
        );
        expect(result.session.metadata?.transport).toBe('remote');
        // Should NOT check extension availability
        expect(
          mockConsoleWallet.checkExtensionAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      // CORRECTED. This asserted `target: 'combined'` and had been wrong since
      // the adapter stopped forwarding that value; nobody noticed because the
      // test was skipped. The adapter DELIBERATELY never sends 'combined' — the
      // SDK's combined mode renders its own connector picker inside
      // #console-wallet-connect-placeholder, which fights our modal, so the
      // adapter resolves the target itself and sends 'local' or 'remote'.
      'combined: resolves to local and never forwards "combined" to the SDK',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.connect(ctx);

        expect(mockConsoleWallet.connect).toHaveBeenCalledWith(
          expect.objectContaining({ target: 'local' }),
        );
        expect(mockConsoleWallet.connect).not.toHaveBeenCalledWith(
          expect.objectContaining({ target: 'combined' }),
        );
        // Extension was available, so activeTransport should be 'injected'
        expect(result.session.metadata?.transport).toBe('injected');
      },
    );

    it(
      'combined: should set remote transport when extension unavailable',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.connect(ctx);

        expect(result.session.metadata?.transport).toBe('remote');
      },
    );

    it(
      'should handle rejected connection',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        mockConsoleWallet.connect.mockResolvedValue({
          isConnected: false,
          reason: 'User rejected',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        await expect(adapter.connect(ctx)).rejects.toThrow();
      },
    );

    it(
      'should include appName and icon in connect request',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'local' });
        await adapter.connect(ctx);

        expect(mockConsoleWallet.connect).toHaveBeenCalledWith({
          name: 'Test App',
          icon: 'https://test.com/favicon.ico',
          target: 'local',
        });
      },
    );

    it(
      'should fallback network to context when getActiveNetwork fails',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();
        mockConsoleWallet.getActiveNetwork.mockRejectedValue(
          new Error('Network query failed'),
        );

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.connect(ctx);

        expect(result.session.network).toBe('devnet');
      },
    );

    // ── isRecognizedNetwork fallback (network resolution; target 'remote' needs
    //    no window so these run unconditionally) ───────────────────────────────
    it('connect: unrecognized wallet network ("CANTON_NETWORK") falls back to ctx.network', async () => {
      setupSuccessfulConnect();
      // The real Console extension reports the env-agnostic label "CANTON_NETWORK".
      mockConsoleWallet.getActiveNetwork.mockResolvedValue({ id: 'CANTON_NETWORK' });

      const adapter = new ConsoleAdapter({ target: 'remote' });
      const result = await adapter.connect(ctx); // ctx.network === 'devnet'

      expect(result.session.network).toBe('devnet'); // fell back, no false mismatch
      expect(result.session.network).not.toBe('CANTON_NETWORK');
    });

    it('connect: a RECOGNIZED wallet network is used (no regression)', async () => {
      setupSuccessfulConnect();
      // Recognized AND different from ctx.network ('devnet') to prove it is USED.
      mockConsoleWallet.getActiveNetwork.mockResolvedValue({ id: 'mainnet' });

      const adapter = new ConsoleAdapter({ target: 'remote' });
      const result = await adapter.connect(ctx);

      expect(result.session.network).toBe('mainnet');
    });

    it('connect: getActiveNetwork throwing falls back to ctx.network', async () => {
      setupSuccessfulConnect();
      mockConsoleWallet.getActiveNetwork.mockRejectedValue(new Error('Network query failed'));

      const adapter = new ConsoleAdapter({ target: 'remote' });
      const result = await adapter.connect(ctx);

      expect(result.session.network).toBe('devnet');
    });

    it(
      'should include provider metadata when available',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.connect(ctx);

        expect(result.session.metadata?.providerId).toBe('provider-1');
        expect(result.session.metadata?.providerType).toBe('validator');
      },
    );
  });

  // =========================================================================
  // disconnect()
  // =========================================================================
  describe('disconnect', () => {
    it(
      'should call SDK disconnect and clear active transport',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();
        mockConsoleWallet.disconnect.mockResolvedValue(undefined);

        const adapter = new ConsoleAdapter({ target: 'local' });
        const connectResult = await adapter.connect(ctx);

        const session = {
          ...connectResult.session,
          sessionId: toSessionId('s1'),
          partyId: toPartyId('party::test-user'),
          origin: 'https://test.com',
          capabilitiesSnapshot: adapter.getCapabilities(),
        };

        await adapter.disconnect(ctx, session);
        expect(mockConsoleWallet.disconnect).toHaveBeenCalled();
      },
    );

    it(
      'should not throw if SDK disconnect fails',
      async () => {
        mockConsoleWallet.disconnect.mockRejectedValue(
          new Error('disconnect error'),
        );

        const adapter = new ConsoleAdapter({ target: 'local' });
        const session = {
          sessionId: toSessionId('s1'),
          walletId: toWalletId('console'),
          partyId: toPartyId('party::test'),
          network: 'devnet' as const,
          createdAt: Date.now(),
          origin: 'https://test.com',
          capabilitiesSnapshot: [] as string[],
        };

        // Should not throw
        await adapter.disconnect(ctx, session as any);
        expect(ctx.logger.warn).toHaveBeenCalled();
      },
    );
  });

  // =========================================================================
  // restore()
  // =========================================================================
  describe('restore', () => {
    it(
      'should return null for expired sessions',
      async () => {
        const adapter = new ConsoleAdapter({ target: 'local' });
        const persisted = createPersistedSession({
          expiresAt: Date.now() - 1000,
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).toBeNull();
      },
    );

    it(
      'local: should return null if extension unavailable',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        const persisted = createPersistedSession();
        const result = await adapter.restore(ctx, persisted);
        expect(result).toBeNull();
      },
    );

    it(
      'local: should restore when extension available and connected',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        mockConsoleWallet.isConnected.mockResolvedValue({
          isConnected: true,
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        const persisted = createPersistedSession({
          metadata: { transport: 'injected' },
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).not.toBeNull();
        expect(result?.walletId).toBe(toWalletId('console'));
      },
    );

    it(
      'should return null if isConnected returns false',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        mockConsoleWallet.isConnected.mockResolvedValue({
          isConnected: false,
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        const persisted = createPersistedSession({
          metadata: { transport: 'injected' },
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).toBeNull();
      },
    );

    it(
      'remote: should skip extension check and restore via isConnected',
      async () => {
        mockConsoleWallet.isConnected.mockResolvedValue({
          isConnected: true,
        });

        const adapter = new ConsoleAdapter({ target: 'remote' });
        const persisted = createPersistedSession({
          metadata: { transport: 'remote' },
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).not.toBeNull();
        // Should NOT check extension availability for remote sessions
        expect(
          mockConsoleWallet.checkExtensionAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'combined: should restore remote session even without extension',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });
        mockConsoleWallet.isConnected.mockResolvedValue({
          isConnected: true,
        });

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const persisted = createPersistedSession({
          metadata: { transport: 'remote' },
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).not.toBeNull();
      },
    );

    it(
      'should handle restore errors gracefully',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockRejectedValue(
          new Error('Extension crashed'),
        );

        const adapter = new ConsoleAdapter({ target: 'local' });
        const persisted = createPersistedSession({
          metadata: { transport: 'injected' },
        });
        const result = await adapter.restore(ctx, persisted);
        expect(result).toBeNull();
        expect(ctx.logger.warn).toHaveBeenCalled();
      },
    );
  });

  // =========================================================================
  // signMessage()
  // =========================================================================
  describe('signMessage', () => {
    const session = {
      sessionId: toSessionId('s1'),
      walletId: toWalletId('console'),
      partyId: toPartyId('party::signer'),
      network: 'devnet' as const,
      createdAt: Date.now(),
      origin: 'https://test.com',
      capabilitiesSnapshot: ['signMessage'],
    };

    it(
      'should base64-encode the message and call the SDK with { message: { base64 } } and NO metaData',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue('sig_abc123');

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.signMessage(ctx, session as any, {
          message: 'Hello',
        });

        // base64('Hello') === 'SGVsbG8='. No { hex } object, no metaData.
        expect(mockConsoleWallet.signMessage).toHaveBeenCalledWith({
          message: { base64: 'SGVsbG8=' },
        });
        const callArg = mockConsoleWallet.signMessage.mock.calls[0][0] as Record<string, unknown>;
        expect('metaData' in callArg).toBe(false);
        expect('hex' in (callArg.message as object)).toBe(false);

        expect(result.signature).toBeTruthy();
        expect(result.partyId).toBe(toPartyId('party::signer'));
        expect(result.message).toBe('Hello');
      },
    );

    it(
      'normalizes a STRING response (dapp-sdk SignedMessageResponse = string)',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue('0xRAWSIG');
        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.signMessage(ctx, session as any, { message: 'Hello' });
        expect(String(result.signature)).toBe('0xRAWSIG');
      },
    );

    it(
      'normalizes a { signature } OBJECT response (defensive)',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue({ signature: '0xFROMOBJECT' } as any);
        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.signMessage(ctx, session as any, { message: 'Hello' });
        expect(String(result.signature)).toBe('0xFROMOBJECT');
      },
    );

    it(
      'preserves domain and nonce on the SignedMessage (no longer sent as metaData)',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue('sig_xyz');

        const adapter = new ConsoleAdapter();
        const result = await adapter.signMessage(ctx, session as any, {
          message: 'Test',
          domain: 'test.com',
          nonce: 'nonce-1',
        });

        // domain/nonce are NOT sent to the wallet (no metaData); preserved on output.
        const callArg = mockConsoleWallet.signMessage.mock.calls[0][0] as Record<string, unknown>;
        expect('metaData' in callArg).toBe(false);
        expect(result.domain).toBe('test.com');
        expect(result.nonce).toBe('nonce-1');
        expect(result.message).toBe('Test');
      },
    );

    it(
      'should throw mapped error on SDK failure',
      async () => {
        mockConsoleWallet.signMessage.mockRejectedValue(
          new Error('User rejected'),
        );

        const adapter = new ConsoleAdapter();
        await expect(
          adapter.signMessage(ctx, session as any, { message: 'fail' }),
        ).rejects.toThrow();
      },
    );
  });

  // =========================================================================
  // signTransaction()
  // =========================================================================
  describe('signTransaction', () => {
    const session = {
      sessionId: toSessionId('s1'),
      walletId: toWalletId('console'),
      partyId: toPartyId('party::signer'),
      network: 'devnet' as const,
      createdAt: Date.now(),
      origin: 'https://test.com',
      capabilitiesSnapshot: ['signTransaction'],
    };

    it(
      'should call submitCommands and return signed transaction',
      async () => {
        const txPayload = {
          from: 'party::sender',
          to: 'party::receiver',
          token: 'USD',
          amount: '100',
          expireDate: '2026-12-31',
        };
        mockConsoleWallet.submitCommands.mockResolvedValue({
          status: true,
          signature: 'tx-sig',
        });

        const adapter = new ConsoleAdapter();
        const result = await adapter.signTransaction(ctx, session as any, {
          tx: txPayload,
        });

        expect(mockConsoleWallet.submitCommands).toHaveBeenCalledWith(txPayload);
        expect(result.signedTx).toEqual({ status: true, signature: 'tx-sig' });
        expect(result.transactionHash).toBeTruthy();
        expect(result.partyId).toBe(toPartyId('party::signer'));
      },
    );
  });

  // =========================================================================
  // submitTransaction()
  // =========================================================================
  describe('submitTransaction', () => {
    const session = {
      sessionId: toSessionId('s1'),
      walletId: toWalletId('console'),
      partyId: toPartyId('party::signer'),
      network: 'devnet' as const,
      createdAt: Date.now(),
      origin: 'https://test.com',
      capabilitiesSnapshot: ['submitTransaction'],
    };

    it(
      'should call submitCommands with waitForFinalization',
      async () => {
        const txPayload = {
          from: 'party::sender',
          to: 'party::receiver',
          token: 'USD',
          amount: '100',
          expireDate: '2026-12-31',
        };
        mockConsoleWallet.submitCommands.mockResolvedValue({
          status: true,
          signature: 'final-sig',
        });

        const adapter = new ConsoleAdapter();
        const result = await adapter.submitTransaction(ctx, session as any, {
          signedTx: txPayload,
        });

        expect(mockConsoleWallet.submitCommands).toHaveBeenCalledWith({
          ...txPayload,
          waitForFinalization: 5000,
        });
        expect(result.transactionHash).toBeTruthy();
        expect(result.submittedAt).toBeGreaterThan(0);
      },
    );
  });

  // =========================================================================
  // ledgerApi()
  // =========================================================================
  describe('ledgerApi', () => {
    const session = {
      sessionId: toSessionId('s1'),
      walletId: toWalletId('console'),
      partyId: toPartyId('party::user'),
      network: 'devnet' as const,
      createdAt: Date.now(),
      origin: 'https://test.com',
      capabilitiesSnapshot: ['ledgerApi'],
    };

    // CORRECTED. This could never reach the code it names: the shared hoisted
    // mock always defines `ledgerApi: vi.fn()`, so the adapter's
    // `typeof wallet.ledgerApi === 'function'` branch always won and the throw
    // was unreachable. The un-stubbed spy returned undefined, the adapter
    // wrapped it, and the call RESOLVED with `{ response: undefined }` — a test
    // asserting a rejection that was passing only because it never ran.
    it('throws CapabilityNotSupportedError when the SDK exposes neither ledgerApi nor request', async () => {
      const original = {
        ledgerApi: mockConsoleWallet.ledgerApi,
        request: (mockConsoleWallet as Record<string, unknown>).request,
      };
      // Remove BOTH paths so the fallthrough is actually reachable.
      delete (mockConsoleWallet as Record<string, unknown>).ledgerApi;
      delete (mockConsoleWallet as Record<string, unknown>).request;
      try {
        const adapter = new ConsoleAdapter();
        await expect(
          adapter.ledgerApi(ctx, session as any, {
            requestMethod: 'GET',
            resource: '/v1/parties',
          }),
        ).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
      } finally {
        mockConsoleWallet.ledgerApi = original.ledgerApi;
        if (original.request !== undefined) {
          (mockConsoleWallet as Record<string, unknown>).request = original.request;
        }
      }
    });
  });

  // =========================================================================
  // on() — event subscriptions
  // =========================================================================
  describe('on', () => {
    it(
      'should subscribe to AND deliver connection status changes',
      async () => {
        const adapter = new ConsoleAdapter();
        const handler = vi.fn();
        adapter.on('connect', handler);
        // The SDK loads lazily, so the subscription registers one microtask later.
        await vi.waitFor(() =>
          expect(mockConsoleWallet.onConnectionStatusChanged).toHaveBeenCalled(),
        );
        // The deferred subscription still delivers events to the handler.
        const cb = mockConsoleWallet.onConnectionStatusChanged.mock.calls[0][0];
        cb({ isConnected: true });
        expect(handler).toHaveBeenCalledWith({ isConnected: true });
      },
    );

    it('should subscribe to tx status changes', async () => {
      const adapter = new ConsoleAdapter();
      const handler = vi.fn();
      adapter.on('txStatus', handler);
      await vi.waitFor(() =>
        expect(mockConsoleWallet.onTxStatusChanged).toHaveBeenCalled(),
      );
    });

    it('should return unsubscribe function', () => {
      const adapter = new ConsoleAdapter();
      const unsub = adapter.on('error', vi.fn());
      expect(typeof unsub).toBe('function');
    });
  });

  // =========================================================================
  // Error context transport reporting
  // =========================================================================
  describe('error context transport reporting', () => {
    it(
      'local: should report transport=injected in errors',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        mockConsoleWallet.connect.mockRejectedValue(
          new Error('connect failed'),
        );

        const adapter = new ConsoleAdapter({ target: 'local' });
        try {
          await adapter.connect(ctx);
        } catch (err: any) {
          expect(err.context?.transport ?? err.message).toBeDefined();
        }
      },
    );

    it(
      'remote: should report transport=remote in errors',
      async () => {
        mockConsoleWallet.connect.mockRejectedValue(
          new Error('relay timeout'),
        );

        const adapter = new ConsoleAdapter({ target: 'remote' });
        try {
          await adapter.connect(ctx);
        } catch (err: any) {
          expect(err.context?.transport ?? err.message).toBeDefined();
        }
      },
    );
  });

  // =========================================================================
  // Backward compatibility
  // =========================================================================
  describe('backward compatibility', () => {
    it('default adapter should support all original capabilities', () => {
      const adapter = new ConsoleAdapter();
      const caps = adapter.getCapabilities();
      // All original capabilities must still be present
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('restore');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('signTransaction');
      expect(caps).toContain('submitTransaction');
      expect(caps).toContain('ledgerApi');
      expect(caps).toContain('events');
      expect(caps).toContain('injected');
    });

    it('local mode should match original capabilities exactly', () => {
      const adapter = new ConsoleAdapter({ target: 'local' });
      const caps = adapter.getCapabilities();
      // The exact list, so a capability can never be dropped or reordered
      // unnoticed. It grew once, deliberately: `transfer` was added when the
      // adapter gained requestTransfer, because Console satisfies both halves
      // of that contract (a typed sign-and-send the user must approve, and a
      // real update id on the txChanged stream). Nothing was removed; a wallet
      // must declare the capability for a dApp to be able to ask for it.
      const expected = [
        'connect',
        'disconnect',
        'restore',
        'signMessage',
        'signTransaction',
        'submitTransaction',
        'ledgerApi',
        'transfer',
        'events',
        'injected',
      ];
      expect(caps).toEqual(expected);
    });

    it('still reports every pre-transfer capability, in order', () => {
      // The backward-compatibility guarantee stated as what it actually is:
      // no capability that existed before requestTransfer was removed.
      const caps = new ConsoleAdapter({ target: 'local' }).getCapabilities();
      const original = [
        'connect',
        'disconnect',
        'restore',
        'signMessage',
        'signTransaction',
        'submitTransaction',
        'ledgerApi',
        'events',
        'injected',
      ];
      expect(caps.filter((c) => original.includes(c))).toEqual(original);
    });

    it('no-arg constructor should work (backward compatible)', () => {
      const adapter = new ConsoleAdapter();
      expect(adapter.walletId).toBe(toWalletId('console'));
      expect(adapter.name).toBe('Console Wallet');
    });
  });

  describe('ledgerApi normalization (CIP-0103: lower-case verb + OBJECT body)', () => {
    const session = {
      sessionId: toSessionId('s1'),
      walletId: toWalletId('console'),
      partyId: toPartyId('party::test'),
      network: 'devnet' as const,
      createdAt: 0,
      origin: 'https://test.com',
      capabilitiesSnapshot: [] as string[],
    } as unknown as Session;

    it('lower-cases the verb + parses a string body to an object on the wire', async () => {
      mockConsoleWallet.ledgerApi.mockResolvedValue({ response: 'ok' });
      const adapter = new ConsoleAdapter({ target: 'local' });
      await adapter.ledgerApi(createMockContext(), session, {
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: '{"filter":{"x":1}}',
      });
      expect(mockConsoleWallet.ledgerApi).toHaveBeenCalledWith({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: { filter: { x: 1 } },
      });
    });

    it('passes an object body through unchanged (lower-case verb)', async () => {
      mockConsoleWallet.ledgerApi.mockResolvedValue({ response: 'ok' });
      const adapter = new ConsoleAdapter({ target: 'local' });
      const body = { filter: { y: 2 } };
      await adapter.ledgerApi(createMockContext(), session, {
        requestMethod: 'get',
        resource: '/v2/state/active-contracts',
        body,
      });
      expect(mockConsoleWallet.ledgerApi).toHaveBeenCalledWith({
        requestMethod: 'get',
        resource: '/v2/state/active-contracts',
        body,
      });
    });
  });
});
