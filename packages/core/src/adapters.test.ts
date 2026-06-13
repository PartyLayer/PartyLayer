/**
 * Adapter contract compliance tests
 * 
 * These tests verify that adapters implement the WalletAdapter interface correctly.
 */

import { describe, it, expect } from 'vitest';
import type { WalletAdapter, CapabilityKey } from './adapters';
import {
  capabilityGuard,
  installGuard,
  isOfficialProviderAdapter,
  CapabilityNotSupportedError,
  WalletNotInstalledError,
} from './adapters';
import { toWalletId } from './types';

/**
 * Mock adapter for testing
 */
class MockAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock');
  readonly name = 'Mock Wallet';
  private installed = true;
  private capabilities: CapabilityKey[] = ['connect', 'disconnect'];

  setInstalled(installed: boolean): void {
    this.installed = installed;
  }

  setCapabilities(capabilities: CapabilityKey[]): void {
    this.capabilities = capabilities;
  }

  getCapabilities(): CapabilityKey[] {
    return this.capabilities;
  }

  async detectInstalled() {
    return {
      installed: this.installed,
      reason: this.installed ? undefined : 'Not installed',
    };
  }

  async connect() {
    throw new Error('Not implemented in mock');
  }

  async disconnect() {
    throw new Error('Not implemented in mock');
  }
}

describe('Adapter Contract', () => {
  describe('capabilityGuard', () => {
    it('should pass when all capabilities are supported', () => {
      const adapter = new MockAdapter();
      adapter.setCapabilities(['connect', 'disconnect', 'signMessage']);

      expect(() => {
        capabilityGuard(adapter, ['connect', 'signMessage']);
      }).not.toThrow();
    });

    it('should throw CapabilityNotSupportedError when capability missing', () => {
      const adapter = new MockAdapter();
      adapter.setCapabilities(['connect', 'disconnect']);

      expect(() => {
        capabilityGuard(adapter, ['signMessage']);
      }).toThrow(CapabilityNotSupportedError);
    });
  });

  describe('installGuard', () => {
    it('should pass when wallet is installed', async () => {
      const adapter = new MockAdapter();
      adapter.setInstalled(true);

      await expect(installGuard(adapter)).resolves.not.toThrow();
    });

    it('should throw WalletNotInstalledError when not installed', async () => {
      const adapter = new MockAdapter();
      adapter.setInstalled(false);

      await expect(installGuard(adapter)).rejects.toThrow(WalletNotInstalledError);
    });
  });

  describe('WalletAdapter interface', () => {
    it('should have required properties', () => {
      const adapter = new MockAdapter();
      expect(adapter.walletId).toBeDefined();
      expect(adapter.name).toBeDefined();
    });

    it('should implement getCapabilities', () => {
      const adapter = new MockAdapter();
      const caps = adapter.getCapabilities();
      expect(Array.isArray(caps)).toBe(true);
    });

    it('should implement detectInstalled', async () => {
      const adapter = new MockAdapter();
      const result = await adapter.detectInstalled();
      expect(result).toHaveProperty('installed');
      expect(typeof result.installed).toBe('boolean');
    });
  });

  describe('isOfficialProviderAdapter', () => {
    const provider = {
      request: async () => undefined,
      on() { return provider; },
      emit() { return true; },
      removeListener() { return provider; },
    };
    const official = {
      providerId: 'walley',
      name: 'Walley',
      type: 'browser',
      detect: async () => true,
      provider: () => provider,
      restore: async () => null,
    };

    it('accepts a structurally-complete official ProviderAdapter', () => {
      expect(isOfficialProviderAdapter(official)).toBe(true);
    });

    it('accepts the minimal required surface (providerId + detect + provider)', () => {
      expect(
        isOfficialProviderAdapter({
          providerId: 'x',
          detect: async () => false,
          provider: () => provider,
        }),
      ).toBe(true);
    });

    it('rejects missing/empty providerId', () => {
      expect(isOfficialProviderAdapter({ ...official, providerId: '' })).toBe(false);
      const { providerId: _omit, ...noId } = official;
      expect(isOfficialProviderAdapter(noId)).toBe(false);
    });

    it('rejects when detect or provider is not a function', () => {
      expect(isOfficialProviderAdapter({ ...official, detect: true })).toBe(false);
      expect(isOfficialProviderAdapter({ ...official, provider: 'nope' })).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(isOfficialProviderAdapter(null)).toBe(false);
      expect(isOfficialProviderAdapter(undefined)).toBe(false);
      expect(isOfficialProviderAdapter('walley')).toBe(false);
    });
  });
});
