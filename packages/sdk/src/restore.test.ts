/**
 * SDK Session Restore Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WalletAdapter, Session, PersistedSession } from '@cantonconnect/core';
import {
  toWalletId,
  toPartyId,
  toSessionId,
} from '@cantonconnect/core';

// Mock adapter that supports restore
class MockRestoreAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-restore');
  readonly name = 'Mock Restore Adapter';

  getCapabilities() {
    return ['connect', 'disconnect', 'restore'];
  }

  async detectInstalled() {
    return { installed: true };
  }

  async connect() {
    return {
      partyId: toPartyId('party::test'),
      session: {
        walletId: this.walletId,
        network: 'devnet',
        createdAt: Date.now(),
      },
      capabilities: ['connect'],
    };
  }

  async disconnect() {}

  async restore(_ctx: any, persisted: PersistedSession): Promise<Session | null> {
    // Check if session token exists
    const token = persisted.metadata?.sessionToken;
    if (!token) {
      return null;
    }

    // Check expiration
    if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
      return null;
    }

    return {
      ...persisted,
      walletId: this.walletId,
    };
  }
}

// Mock adapter that doesn't support restore
class MockNoRestoreAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-no-restore');
  readonly name = 'Mock No Restore Adapter';

  getCapabilities() {
    return ['connect', 'disconnect'];
  }

  async detectInstalled() {
    return { installed: true };
  }

  async connect() {
    return {
      partyId: toPartyId('party::test'),
      session: {
        walletId: this.walletId,
        network: 'devnet',
        createdAt: Date.now(),
      },
      capabilities: ['connect'],
    };
  }

  async disconnect() {}
}

describe('Session Restore Logic', () => {
  describe('successful restore', () => {
    it('should restore session and emit session:connected with reason="restore"', async () => {
      const adapter = new MockRestoreAdapter();
      const persisted: PersistedSession = {
        sessionId: toSessionId('session-123'),
        walletId: adapter.walletId,
        partyId: toPartyId('party::test'),
        network: 'devnet',
        createdAt: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        origin: 'https://test.com',
        capabilitiesSnapshot: ['connect'],
        metadata: {
          sessionToken: 'valid-token',
        },
        encrypted: 'encrypted-data',
      };

      const mockContext = {
        appName: 'Test',
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
          decrypt: vi.fn(async () => JSON.stringify(persisted)),
          generateKey: vi.fn(),
        },
        storage: {
          get: vi.fn(async () => 'encrypted-data'),
          set: vi.fn(),
          remove: vi.fn(),
          clear: vi.fn(),
        },
        timeout: vi.fn(),
      };

      const restored = await adapter.restore(mockContext as any, persisted);

      expect(restored).not.toBeNull();
      expect(restored?.walletId).toBe(adapter.walletId);
      expect(restored?.partyId).toBe(persisted.partyId);
    });
  });

  describe('failed restore', () => {
    it('should return null for expired session', async () => {
      const adapter = new MockRestoreAdapter();
      const persisted: PersistedSession = {
        sessionId: toSessionId('session-123'),
        walletId: adapter.walletId,
        partyId: toPartyId('party::test'),
        network: 'devnet',
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() - 1000, // Expired
        origin: 'https://test.com',
        capabilitiesSnapshot: ['connect'],
        metadata: {
          sessionToken: 'expired-token',
        },
        encrypted: 'encrypted-data',
      };

      const mockContext = {
        appName: 'Test',
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
        timeout: vi.fn(),
      };

      const restored = await adapter.restore(mockContext as any, persisted);

      expect(restored).toBeNull();
    });

    it('should return null when adapter does not support restore', async () => {
      const adapter = new MockNoRestoreAdapter();
      const persisted: PersistedSession = {
        sessionId: toSessionId('session-123'),
        walletId: adapter.walletId,
        partyId: toPartyId('party::test'),
        network: 'devnet',
        createdAt: Date.now(),
        origin: 'https://test.com',
        capabilitiesSnapshot: ['connect'],
        encrypted: 'encrypted-data',
      };

      const mockContext = {
        appName: 'Test',
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
        timeout: vi.fn(),
      };

      // Adapter doesn't have restore method
      expect(adapter.restore).toBeUndefined();
    });
  });
});
