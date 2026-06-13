/**
 * Tests for registry schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateRegistry,
  validateWalletEntry,
  registryEntryToMetadata,
  REGISTRY_SCHEMA_VERSION,
} from './schema';
import type { WalletRegistryV1, RegistryWalletEntry } from './schema';
import { toWalletId } from '@partylayer/core';

describe('registry schema validation', () => {
  const validWalletEntry: RegistryWalletEntry = {
    id: 'test-wallet',
    name: 'Test Wallet',
    description: 'A test wallet',
    homepage: 'https://test.com',
    icon: 'https://test.com/icon.png',
    supportedNetworks: ['mainnet', 'devnet'],
    capabilities: {
      signMessage: true,
      signTransaction: true,
      submitTransaction: true,
      transactionStatus: true,
      switchNetwork: false,
      multiParty: false,
    },
    adapter: {
      type: 'test',
    },
  };

  const validRegistry: WalletRegistryV1 = {
    metadata: {
      registryVersion: '1.0.0',
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      publishedAt: new Date().toISOString(),
      channel: 'stable',
      sequence: 1,
    },
    wallets: [validWalletEntry],
  };

  describe('validateWalletEntry', () => {
    it('should validate a valid wallet entry', () => {
      expect(validateWalletEntry(validWalletEntry)).toBe(true);
    });

    it('should reject invalid entries', () => {
      expect(validateWalletEntry(null)).toBe(false);
      expect(validateWalletEntry({})).toBe(false);
      expect(validateWalletEntry({ id: 'test' })).toBe(false);
    });

    it('accepts an absent adapter.transport (back-compat default)', () => {
      expect(validateWalletEntry(validWalletEntry)).toBe(true); // no transport field
    });

    it('accepts every valid adapter.transport value', () => {
      for (const transport of ['injected', 'announce', 'discovery-adapter'] as const) {
        const entry: RegistryWalletEntry = {
          ...validWalletEntry,
          adapter: { type: '@k2flabs/walley-dapp-sdk', transport, config: { providerId: 'walley' } },
        };
        expect(validateWalletEntry(entry)).toBe(true);
      }
    });

    it('rejects an unknown adapter.transport value', () => {
      const entry = {
        ...validWalletEntry,
        adapter: { type: 'test', transport: 'window.canton' }, // not a valid AdapterTransport
      };
      expect(validateWalletEntry(entry)).toBe(false);
    });
  });

  describe('validateRegistry', () => {
    it('should validate a valid registry', () => {
      expect(validateRegistry(validRegistry)).toBe(true);
    });

    it('should reject invalid registries', () => {
      expect(validateRegistry(null)).toBe(false);
      expect(validateRegistry({})).toBe(false);
      expect(validateRegistry({ metadata: {} })).toBe(false);
    });
  });

  describe('registryEntryToMetadata', () => {
    it('should convert entry to metadata', () => {
      const walletInfo = registryEntryToMetadata(validWalletEntry);
      // registryEntryToMetadata returns WalletInfo, not the raw entry
      expect(walletInfo.walletId).toBe(toWalletId(validWalletEntry.id));
      expect(walletInfo.name).toBe(validWalletEntry.name);
      // capabilities is transformed to CapabilityKey[]
      expect(walletInfo.capabilities).toContain('signMessage');
      expect(walletInfo.capabilities).toContain('signTransaction');
    });
  });
});
