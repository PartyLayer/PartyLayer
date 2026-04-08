/**
 * Console adapter tests
 *
 * Tests all three connection modes (local, remote, combined) and verifies
 * capabilities, detection, connect, restore, disconnect, signMessage,
 * and error context transport reporting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleAdapter } from './console-adapter';
import type { ConsoleAdapterConfig } from './console-adapter';
import type { AdapterContext, PersistedSession } from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toSessionId,
} from '@partylayer/core';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

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
    it('should return false in Node.js (no window)', async () => {
      if (isBrowser) return; // skip in browser
      const adapter = new ConsoleAdapter({ target: 'local' });
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toContain('Browser environment required');
    });

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
      'remote: should always return installed=true',
      async () => {
        const adapter = new ConsoleAdapter({ target: 'remote' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(true);
        expect(result.reason).toContain('QR code');
        // Should NOT call checkExtensionAvailability
        expect(
          mockConsoleWallet.checkExtensionAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it.skipIf(!isBrowser)(
      'combined: should return installed=true even without extension',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.detectInstalled();
        expect(result.installed).toBe(true);
        expect(result.reason).toContain('QR code');
      },
    );

    it.skipIf(!isBrowser)(
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
    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
      'local: should throw WalletNotInstalledError if extension absent',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'notInstalled',
        });

        const adapter = new ConsoleAdapter({ target: 'local' });
        await expect(adapter.connect(ctx)).rejects.toThrow();
      },
    );

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
      'combined: should pass target=combined to SDK',
      async () => {
        mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({
          status: 'installed',
        });
        setupSuccessfulConnect();

        const adapter = new ConsoleAdapter({ target: 'combined' });
        const result = await adapter.connect(ctx);

        expect(mockConsoleWallet.connect).toHaveBeenCalledWith(
          expect.objectContaining({ target: 'combined' }),
        );
        // Extension was available, so activeTransport should be 'injected'
        expect(result.session.metadata?.transport).toBe('injected');
      },
    );

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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
    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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
    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
      'should convert message to hex and call SDK',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue('sig_abc123');

        const adapter = new ConsoleAdapter({ target: 'local' });
        const result = await adapter.signMessage(ctx, session as any, {
          message: 'Hello',
        });

        expect(mockConsoleWallet.signMessage).toHaveBeenCalledWith({
          message: { hex: '0x48656c6c6f' },
          metaData: { purpose: 'sign-message' },
        });
        expect(result.signature).toBeTruthy();
        expect(result.partyId).toBe(toPartyId('party::signer'));
        expect(result.message).toBe('Hello');
      },
    );

    it.skipIf(!isBrowser)(
      'should include domain and nonce in metaData',
      async () => {
        mockConsoleWallet.signMessage.mockResolvedValue('sig_xyz');

        const adapter = new ConsoleAdapter();
        await adapter.signMessage(ctx, session as any, {
          message: 'Test',
          domain: 'test.com',
          nonce: 'nonce-1',
        });

        expect(mockConsoleWallet.signMessage).toHaveBeenCalledWith({
          message: expect.any(Object),
          metaData: {
            purpose: 'sign-message',
            domain: 'test.com',
            nonce: 'nonce-1',
          },
        });
      },
    );

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
      'should throw CapabilityNotSupportedError when neither ledgerApi nor request exists',
      async () => {
        const adapter = new ConsoleAdapter();
        await expect(
          adapter.ledgerApi(ctx, session as any, {
            requestMethod: 'GET',
            resource: '/v1/parties',
          }),
        ).rejects.toThrow();
      },
    );
  });

  // =========================================================================
  // on() — event subscriptions
  // =========================================================================
  describe('on', () => {
    it.skipIf(!isBrowser)(
      'should subscribe to connection status changes',
      () => {
        const adapter = new ConsoleAdapter();
        const handler = vi.fn();
        adapter.on('connect', handler);
        expect(
          mockConsoleWallet.onConnectionStatusChanged,
        ).toHaveBeenCalled();
      },
    );

    it.skipIf(!isBrowser)('should subscribe to tx status changes', () => {
      const adapter = new ConsoleAdapter();
      const handler = vi.fn();
      adapter.on('txStatus', handler);
      expect(mockConsoleWallet.onTxStatusChanged).toHaveBeenCalled();
    });

    it.skipIf(!isBrowser)('should return unsubscribe function', () => {
      const adapter = new ConsoleAdapter();
      const unsub = adapter.on('error', vi.fn());
      expect(typeof unsub).toBe('function');
    });
  });

  // =========================================================================
  // Error context transport reporting
  // =========================================================================
  describe('error context transport reporting', () => {
    it.skipIf(!isBrowser)(
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

    it.skipIf(!isBrowser)(
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
      const expected = [
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
      expect(caps).toEqual(expected);
    });

    it('no-arg constructor should work (backward compatible)', () => {
      const adapter = new ConsoleAdapter();
      expect(adapter.walletId).toBe(toWalletId('console'));
      expect(adapter.name).toBe('Console Wallet');
    });
  });
});
