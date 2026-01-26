/**
 * Registry Client Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegistryClient } from './client';
import type { WalletRegistryV1 } from './schema';
import {
  RegistryVerificationFailedError,
} from '@cantonconnect/core';

describe('RegistryClient', () => {
  let client: RegistryClient;
  let mockStorage: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    client = new RegistryClient({
      registryUrl: 'https://registry.test.com',
      channel: 'stable',
      storage: mockStorage as any,
      registryPublicKeys: [], // No keys for testing
    });
  });

  describe('downgrade protection', () => {
    it('should reject registry with lower sequence number', async () => {
      // Set up cached registry with sequence 10
      const cachedRegistry: WalletRegistryV1 = {
        metadata: {
          registryVersion: '1',
          schemaVersion: '1',
          publishedAt: new Date().toISOString(),
          channel: 'stable',
          sequence: 10,
        },
        wallets: [],
      };

      // Inject cached registry into client's memory cache
      (client as any).memoryCache.lastKnownGood = {
        registry: cachedRegistry,
        verified: true,
        fetchedAt: Date.now(),
        sequence: 10,
      };

      // Mock fetch returning registry with sequence 9 (downgrade)
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            metadata: {
              registryVersion: '1',
              schemaVersion: '1',
              publishedAt: new Date().toISOString(),
              channel: 'stable',
              sequence: 9, // Lower sequence - should be rejected
            },
            wallets: [],
          }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            signature: 'test-sig',
            fingerprint: 'test-fp',
          }),
          headers: new Headers(),
        });

      // Should throw RegistryVerificationFailedError for downgrade
      await expect(client.getWallets()).rejects.toThrow(RegistryVerificationFailedError);
    });
  });

  describe('signature failure fallback', () => {
    it('should fallback to last-known-good on signature verification failure', async () => {
      const goodRegistry: WalletRegistryV1 = {
        metadata: {
          registryVersion: '1',
          schemaVersion: '1',
          publishedAt: new Date().toISOString(),
          channel: 'stable',
          sequence: 5,
        },
        wallets: [],
      };

      // Set up last-known-good cache
      (client as any).memoryCache.lastKnownGood = {
        registry: goodRegistry,
        verified: true,
        fetchedAt: Date.now(),
        sequence: 5,
      };

      // Mock fetch returning tampered registry (signature verification will fail)
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            metadata: {
              registryVersion: '1',
              schemaVersion: '1',
              publishedAt: new Date().toISOString(),
              channel: 'stable',
              sequence: 6,
            },
            wallets: [],
          }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            signature: 'invalid-signature',
            fingerprint: 'test-fp',
          }),
          headers: new Headers(),
        });

      // Should fallback to cached registry
      const wallets = await client.getWallets();
      expect(wallets).toBeDefined();
      
      const status = client.getStatus();
      expect(status?.source).toBe('cache');
    });
  });
});
