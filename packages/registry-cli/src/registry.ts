/**
 * Registry file operations
 * 
 * Internal library for reading/writing registry files safely.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  WalletRegistryV1,
  RegistryWalletEntry,
  RegistryChannel,
} from '@partylayer/registry-client';
import {
  validateRegistry,
  validateWalletEntry,
  REGISTRY_SCHEMA_VERSION,
} from '@partylayer/registry-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getRootDir(): string {
  // Find root by looking for package.json
  let current = __dirname;
  while (current !== '/') {
    if (existsSync(join(current, 'package.json'))) {
      return current;
    }
    current = dirname(current);
  }
  return __dirname;
}

const ROOT_DIR = getRootDir();

/**
 * Get registry file path
 */
export function getRegistryPath(channel: RegistryChannel): string {
  return join(ROOT_DIR, 'registry', 'v1', channel, 'registry.json');
}

/**
 * Get signature file path
 */
export function getSignaturePath(channel: RegistryChannel): string {
  return join(ROOT_DIR, 'registry', 'v1', channel, 'registry.sig');
}

/**
 * Read registry file
 */
export function readRegistry(channel: RegistryChannel): WalletRegistryV1 {
  const path = getRegistryPath(channel);
  if (!existsSync(path)) {
    throw new Error(`Registry file not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const registry = JSON.parse(content) as WalletRegistryV1;

  if (!validateRegistry(registry)) {
    throw new Error('Invalid registry schema');
  }

  return registry;
}

/**
 * Write registry file
 */
export function writeRegistry(channel: RegistryChannel, registry: WalletRegistryV1): void {
  // Validate before writing
  if (!validateRegistry(registry)) {
    throw new Error('Invalid registry schema');
  }

  const path = getRegistryPath(channel);
  const dir = dirname(path);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write with pretty formatting
  writeFileSync(path, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

/**
 * Update publishedAt timestamp
 */
export function updatePublishedAt(registry: WalletRegistryV1): void {
  registry.metadata.publishedAt = new Date().toISOString();
}

/**
 * Increment sequence number
 */
export function incrementSequence(registry: WalletRegistryV1): void {
  registry.metadata.sequence = (registry.metadata.sequence || 0) + 1;
}

/**
 * Find wallet by ID
 */
export function findWallet(
  registry: WalletRegistryV1,
  walletId: string
): RegistryWalletEntry | undefined {
  return registry.wallets.find((w: RegistryWalletEntry) => w.id === walletId);
}

/**
 * Add wallet to registry
 */
export function addWallet(
  registry: WalletRegistryV1,
  wallet: RegistryWalletEntry
): void {
  // Check uniqueness
  if (findWallet(registry, wallet.id)) {
    throw new Error(`Wallet "${wallet.id}" already exists`);
  }

  // Validate wallet entry
  if (!validateWalletEntry(wallet)) {
    throw new Error('Invalid wallet entry');
  }

  registry.wallets.push(wallet);
}

/**
 * Update wallet in registry
 */
export function updateWallet(
  registry: WalletRegistryV1,
  walletId: string,
  updates: Partial<RegistryWalletEntry>
): void {
  const wallet = findWallet(registry, walletId);
  if (!wallet) {
    throw new Error(`Wallet "${walletId}" not found`);
  }

  Object.assign(wallet, updates);

  // Validate updated wallet
  if (!validateWalletEntry(wallet)) {
    throw new Error('Invalid wallet entry after update');
  }
}

/**
 * Remove wallet from registry
 */
export function removeWallet(registry: WalletRegistryV1, walletId: string): void {
  const index = registry.wallets.findIndex((w: RegistryWalletEntry) => w.id === walletId);
  if (index === -1) {
    throw new Error(`Wallet "${walletId}" not found`);
  }

  registry.wallets.splice(index, 1);
}

/**
 * Create new registry structure
 */
export function createRegistry(channel: RegistryChannel): WalletRegistryV1 {
  return {
    metadata: {
      registryVersion: '1.0.0',
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      publishedAt: new Date().toISOString(),
      channel,
      sequence: 0,
      publisher: 'PartyLayer',
    },
    wallets: [],
  };
}

/**
 * Initialize registry structure
 */
export function initRegistry(channel: RegistryChannel): void {
  const path = getRegistryPath(channel);
  if (existsSync(path)) {
    throw new Error(`Registry already exists: ${path}`);
  }

  const registry = createRegistry(channel);
  writeRegistry(channel, registry);
}
