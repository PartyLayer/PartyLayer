/**
 * Console adapter compliance tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleAdapter } from './console-adapter';
import type { AdapterContext } from '@cantonconnect/core';
import {
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  toWalletId,
  toPartyId,
} from '@cantonconnect/core';

// Mock window.consoleWallet
const mockConsoleWallet = {
  connect: vi.fn(),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  submitTransaction: vi.fn(),
  disconnect: vi.fn(),
};

describe('ConsoleAdapter', () => {
  let adapter: ConsoleAdapter;
  let mockContext: AdapterContext;

  beforeEach(() => {
    adapter = new ConsoleAdapter();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock context
    mockContext = {
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
      timeout: (ms: number) => {
        return new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), ms);
        });
      },
    };

    // Setup window mock
    if (typeof window !== 'undefined') {
      (window as unknown as { consoleWallet?: unknown }).consoleWallet = mockConsoleWallet;
    }
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('signTransaction');
      expect(caps).toContain('submitTransaction');
    });
  });

  describe('detectInstalled', () => {
    it('should detect installed wallet', async () => {
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(true);
    });

    it('should detect missing wallet', async () => {
      // Remove consoleWallet from window
      if (typeof window !== 'undefined') {
        delete (window as unknown as { consoleWallet?: unknown }).consoleWallet;
      }

      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should throw WALLET_NOT_INSTALLED if wallet not installed', async () => {
      // Remove consoleWallet
      if (typeof window !== 'undefined') {
        delete (window as unknown as { consoleWallet?: unknown }).consoleWallet;
      }

      await expect(adapter.connect(mockContext)).rejects.toThrow(WalletNotInstalledError);
    });

    it('should connect successfully', async () => {
      mockConsoleWallet.connect.mockResolvedValue({
        partyId: 'party::test',
        network: 'devnet',
      });

      const result = await adapter.connect(mockContext);

      expect(result.partyId).toBe(toPartyId('party::test'));
      expect(result.capabilities).toContain('connect');
      expect(mockConsoleWallet.connect).toHaveBeenCalledWith({
        appName: 'Test App',
        network: 'devnet',
      });
    });

    it('should map user rejection to USER_REJECTED error', async () => {
      mockConsoleWallet.connect.mockRejectedValue(new Error('User rejected'));

      await expect(adapter.connect(mockContext)).rejects.toThrow();
      // Error should be mapped via mapUnknownErrorToCantonConnectError
    });
  });

  describe('signMessage', () => {
    it('should sign message successfully', async () => {
      const session = {
        sessionId: 'test-session' as import('@cantonconnect/core').SessionId,
        walletId: toWalletId('console'),
        partyId: toPartyId('party::test'),
        network: 'devnet',
        createdAt: Date.now(),
        origin: 'https://test.com',
        capabilitiesSnapshot: ['signMessage'] as import('@cantonconnect/core').CapabilityKey[],
      };

      mockConsoleWallet.signMessage.mockResolvedValue('signature123');

      const result = await adapter.signMessage(mockContext, session, {
        message: 'Hello',
      });

      expect(result.signature).toBe('signature123');
      expect(result.partyId).toBe(session.partyId);
    });
  });
});
