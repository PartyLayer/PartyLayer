/**
 * Wallet Registry Schema v1
 * 
 * This schema defines the structure of the wallet registry JSON.
 * The registry is versioned and supports:
 * - Multiple wallet entries
 * - Versioning and rollback
 * - Integrity checks (Ed25519 signatures)
 * - Multi-channel (stable/beta)
 * - Forward compatibility
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type { WalletInfo, NetworkId, CapabilityKey } from '@cantonconnect/core';
import { toWalletId } from '@cantonconnect/core';

/**
 * Registry schema version
 */
export const REGISTRY_SCHEMA_VERSION = '1.0.0';

/**
 * Registry channel
 */
export type RegistryChannel = 'stable' | 'beta';

/**
 * Wallet entry in registry
 */
export interface RegistryWalletEntry {
  /** Wallet identifier (must be unique within channel) */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description?: string;
  /** Homepage URL */
  homepage?: string;
  /** Icon URL (should be absolute) */
  icon?: string;
  /** Supported networks */
  supportedNetworks: NetworkId[];
  /** Wallet capabilities */
  capabilities: {
    signMessage: boolean;
    signTransaction: boolean;
    submitTransaction: boolean;
    transactionStatus: boolean;
    switchNetwork: boolean;
    multiParty: boolean;
  };
  /** Adapter configuration */
  adapter: {
    /** Adapter type/name */
    type: string;
    /** Adapter-specific configuration */
    config?: Record<string, unknown>;
  };
  /** Installation detection hints */
  installation?: {
    /** Check if wallet is installed via window property */
    windowProperty?: string;
    /** Check if wallet is installed via script tag */
    scriptTag?: string;
    /** Check if wallet is installed via browser extension */
    extensionId?: string;
  };
  /** SDK version compatibility */
  sdkVersion?: string;
  /** Metadata version (for cache invalidation) */
  version?: string;
  /** Origin allowlist (optional - if present, only these origins can connect) */
  originAllowlist?: string[];
}

/**
 * Registry metadata
 */
export interface RegistryMetadata {
  /** Registry version (semver) */
  registryVersion: string;
  /** Schema version */
  schemaVersion: string;
  /** ISO 8601 timestamp when registry was published */
  publishedAt: string;
  /** Channel (stable or beta) */
  channel: RegistryChannel;
  /** Monotonic sequence number (increments on each update) */
  sequence: number;
  /** Registry publisher */
  publisher?: string;
}

/**
 * Wallet Registry v1 structure
 * 
 * Note: Signature is NOT embedded. It's in a separate .sig file.
 */
export interface WalletRegistryV1 {
  /** Registry metadata */
  metadata: RegistryMetadata;
  /** Array of wallet entries */
  wallets: RegistryWalletEntry[];
}

/**
 * Registry signature file format
 * 
 * This is stored separately as registry.sig
 */
export interface RegistrySignature {
  /** Signature algorithm (always 'ed25519') */
  algorithm: 'ed25519';
  /** Signature value (base64-encoded) */
  signature: string;
  /** Public key fingerprint (for key identification) */
  keyFingerprint: string;
  /** Timestamp when signed */
  signedAt: string;
}

/**
 * Validate registry structure
 */
export function validateRegistry(
  registry: unknown
): registry is WalletRegistryV1 {
  if (typeof registry !== 'object' || registry === null) {
    return false;
  }

  const r = registry as Record<string, unknown>;

  // Check metadata
  if (!r.metadata || typeof r.metadata !== 'object') {
    return false;
  }

  const metadata = r.metadata as Record<string, unknown>;
  if (
    typeof metadata.registryVersion !== 'string' ||
    typeof metadata.schemaVersion !== 'string' ||
    typeof metadata.publishedAt !== 'string' ||
    typeof metadata.channel !== 'string' ||
    (metadata.channel !== 'stable' && metadata.channel !== 'beta') ||
    typeof metadata.sequence !== 'number' ||
    !Number.isInteger(metadata.sequence) ||
    metadata.sequence < 0
  ) {
    return false;
  }

  // Check wallets array
  if (!Array.isArray(r.wallets)) {
    return false;
  }

  // Validate each wallet entry
  const walletIds = new Set<string>();
  for (const wallet of r.wallets) {
    if (!validateWalletEntry(wallet)) {
      return false;
    }
    // Check uniqueness
    const entry = wallet as RegistryWalletEntry;
    if (walletIds.has(entry.id)) {
      return false;
    }
    walletIds.add(entry.id);
  }

  return true;
}

/**
 * Validate wallet entry
 */
export function validateWalletEntry(
  entry: unknown
): entry is RegistryWalletEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const e = entry as Record<string, unknown>;

  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    Array.isArray(e.supportedNetworks) &&
    typeof e.capabilities === 'object' &&
    e.capabilities !== null &&
    typeof e.adapter === 'object' &&
    e.adapter !== null &&
    typeof (e.adapter as Record<string, unknown>).type === 'string' &&
    (e.originAllowlist === undefined || Array.isArray(e.originAllowlist))
  );
}

/**
 * Convert registry entry to wallet info
 */
export function registryEntryToWalletInfo(
  entry: RegistryWalletEntry,
  channel: RegistryChannel
): WalletInfo {
  const capabilities: CapabilityKey[] = ['connect', 'disconnect'];
  if (entry.capabilities.signMessage) {
    capabilities.push('signMessage');
  }
  if (entry.capabilities.signTransaction) {
    capabilities.push('signTransaction');
  }
  if (entry.capabilities.submitTransaction) {
    capabilities.push('submitTransaction');
  }
  if (entry.capabilities.transactionStatus) {
    capabilities.push('events');
  }

  return {
    walletId: toWalletId(entry.id),
    name: entry.name,
    website: entry.homepage || '',
    icons: {
      sm: entry.icon,
      md: entry.icon,
      lg: entry.icon,
    },
    category: 'browser',
    capabilities,
    installHints: entry.installation
      ? {
          injectedKey: entry.installation.windowProperty,
          extensionId: entry.installation.extensionId,
          deepLinkScheme: entry.installation.scriptTag,
        }
      : undefined,
    adapter: {
      packageName: entry.adapter.type,
      versionRange: entry.sdkVersion || '*',
    },
    docs: entry.homepage ? [entry.homepage] : [],
    minSdkVersion: entry.sdkVersion,
    networks: entry.supportedNetworks,
    channel,
    // Store origin allowlist in metadata for SDK enforcement
    ...(entry.originAllowlist
      ? { metadata: { originAllowlist: JSON.stringify(entry.originAllowlist) } }
      : {}),
  };
}

/**
 * @deprecated Use registryEntryToWalletInfo instead
 */
export function registryEntryToMetadata(
  entry: RegistryWalletEntry
): WalletInfo {
  return registryEntryToWalletInfo(entry, 'stable');
}
