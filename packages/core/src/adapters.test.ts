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
});
