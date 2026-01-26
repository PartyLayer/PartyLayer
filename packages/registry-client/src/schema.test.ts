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
      version: '1.0.0',
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      timestamp: Date.now(),
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
      const metadata = registryEntryToMetadata(validWalletEntry);
      expect(metadata.id).toBe(validWalletEntry.id);
      expect(metadata.name).toBe(validWalletEntry.name);
      expect(metadata.capabilities).toEqual(validWalletEntry.capabilities);
    });
  });
});
