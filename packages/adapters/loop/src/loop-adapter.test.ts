/**
 * Loop adapter compliance tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoopAdapter } from './loop-adapter';
import type { AdapterContext } from '@cantonconnect/core';
import {
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  toWalletId,
  toPartyId,
} from '@cantonconnect/core';

// Mock Loop SDK
const mockLoopSDK = {
  init: vi.fn(),
  connect: vi.fn(),
};

describe('LoopAdapter', () => {
  let adapter: LoopAdapter;
  let mockContext: AdapterContext;

  beforeEach(() => {
    adapter = new LoopAdapter();
    
    vi.clearAllMocks();
    
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

    // Setup window.loop mock
    if (typeof window !== 'undefined') {
      (window as unknown as { loop?: unknown }).loop = mockLoopSDK;
    }
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toContain('connect');
      expect(caps).toContain('disconnect');
      expect(caps).toContain('signMessage');
      expect(caps).toContain('submitTransaction');
      expect(caps).not.toContain('signTransaction'); // Loop doesn't support separate signing
    });
  });

  describe('detectInstalled', () => {
    it('should detect installed SDK', async () => {
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(true);
    });

    it('should detect missing SDK', async () => {
      // Remove loop from window
      if (typeof window !== 'undefined') {
        delete (window as unknown as { loop?: unknown }).loop;
      }

      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should throw WALLET_NOT_INSTALLED if SDK not available', async () => {
      // Remove loop
      if (typeof window !== 'undefined') {
        delete (window as unknown as { loop?: unknown }).loop;
      }

      await expect(adapter.connect(mockContext)).rejects.toThrow(WalletNotInstalledError);
    });

    it('should initialize SDK and connect', async () => {
      let onAccept: ((provider: { party_id: string }) => void) | null = null;

      mockLoopSDK.init.mockImplementation((config: {
        onAccept: (provider: { party_id: string }) => void;
      }) => {
        onAccept = config.onAccept;
      });

      const connectPromise = adapter.connect(mockContext);

      // Simulate user accepting connection
      setTimeout(() => {
        if (onAccept) {
          onAccept({ party_id: 'party::loop-test' });
        }
      }, 100);

      const result = await connectPromise;

      expect(result.partyId).toBe(toPartyId('party::loop-test'));
      expect(mockLoopSDK.init).toHaveBeenCalled();
      expect(mockLoopSDK.connect).toHaveBeenCalled();
    });
  });

  describe('signTransaction', () => {
    it('should throw CapabilityNotSupportedError', async () => {
      const session = {
        sessionId: 'test' as import('@cantonconnect/core').SessionId,
        walletId: toWalletId('loop'),
        partyId: toPartyId('party::test'),
        network: 'devnet',
        createdAt: Date.now(),
        origin: 'https://test.com',
        capabilitiesSnapshot: [] as import('@cantonconnect/core').CapabilityKey[],
      };

      await expect(
        adapter.signTransaction(mockContext, session, { tx: {} })
      ).rejects.toThrow(CapabilityNotSupportedError);
    });
  });
});
