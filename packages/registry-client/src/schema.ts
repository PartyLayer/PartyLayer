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

import type {
  AdapterTransport,
  CapabilityKey,
  Cip0103Support,
  NetworkId,
  ProviderDetection,
  WalletInfo,
} from '@partylayer/core';
import { toWalletId } from '@partylayer/core';

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
    mobileConnect?: boolean;
    remoteSigner?: boolean;
  };
  /** Adapter configuration */
  adapter: {
    /** Adapter type/name */
    type: string;
    /**
     * How the SDK obtains this wallet's provider. Optional + additive — when
     * omitted the SDK uses today's behavior (injected `window.canton` scan /
     * announce). `'discovery-adapter'` routes the entry through the generic
     * official-adapter bridge: the SDK matches an app-supplied
     * `OfficialProviderAdapter` whose `providerId` equals `config.providerId`.
     * No wallet-specific adapter package is involved.
     */
    transport?: AdapterTransport;
    /**
     * Adapter-specific configuration. For `transport: 'discovery-adapter'`,
     * `config.providerId` (string) keys the app-supplied official adapter.
     */
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
    /** Deep link URL for mobile wallet connect */
    deeplink?: string;
    /** OAuth-based authentication */
    oauth?: boolean;
  };
  /** SDK version compatibility */
  sdkVersion?: string;
  /** Metadata version (for cache invalidation) */
  version?: string;
  /** Origin allowlist (optional - if present, only these origins can connect) */
  originAllowlist?: string[];
  /**
   * Marks the entry as beta even when it ships in the `stable` registry
   * channel. UIs (modal, picker, capability matrix) can use this flag to
   * surface a "Beta" badge regardless of which channel file the entry
   * lives in. Optional and additive — older registries omit it and the
   * flag defaults to `false`.
   */
  beta?: boolean;
  /**
   * Optional CIP-0103 runtime detection rules. When present, the SDK +
   * picker can match the currently-injected `window.canton` provider to
   * this entry and surface it in the "CIP-0103 Native" section with full
   * branding. Lets us add new CIP-0103 wallets to the ecosystem with a
   * registry JSON update — no SDK code change required.
   */
  providerDetection?: ProviderDetection;
  /**
   * Canonical CIP-0103 support marker. When `cip0103.native === true`
   * the picker always renders this entry in the "CIP-0103 NATIVE"
   * section, regardless of install state. The accompanying `evidence`
   * field is intended to be a public URL that justifies the claim
   * (npm package readme, blog post, etc.) and may be surfaced by UIs as
   * a tooltip / "verified" link.
   */
  cip0103?: Cip0103Support;
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

  const adapter = e.adapter as Record<string, unknown> | undefined;
  const transport = adapter?.transport;
  const transportValid =
    transport === undefined ||
    transport === 'injected' ||
    transport === 'announce' ||
    transport === 'discovery-adapter';

  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    Array.isArray(e.supportedNetworks) &&
    typeof e.capabilities === 'object' &&
    e.capabilities !== null &&
    typeof adapter === 'object' &&
    adapter !== null &&
    typeof adapter.type === 'string' &&
    transportValid &&
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

  // Transport capabilities — inferred from installation hints and capability flags
  if (entry.installation?.windowProperty) {
    capabilities.push('injected');
  }
  if (entry.installation?.deeplink || entry.capabilities.mobileConnect) {
    capabilities.push('deeplink');
  }
  if (entry.capabilities.remoteSigner) {
    capabilities.push('remoteSigner');
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
    // Adapter metadata is exposed to the picker via WalletInfo.metadata
    // (typed `Record<string, string>`). Two flags routed through here today:
    //   - originAllowlist: SDK-side origin enforcement
    //   - beta:            UI badge ("Beta" tag in modal + capability matrix)
    // Both are optional — only emitted when the registry entry sets them.
    ...((entry.originAllowlist || entry.beta)
      ? {
          metadata: {
            ...(entry.originAllowlist
              ? { originAllowlist: JSON.stringify(entry.originAllowlist) }
              : {}),
            ...(entry.beta ? { beta: 'true' } : {}),
          },
        }
      : {}),
    // CIP-0103 runtime-detection rules pass through verbatim when present;
    // see WalletInfo.providerDetection for how the picker uses them.
    ...(entry.providerDetection ? { providerDetection: entry.providerDetection } : {}),
    // Canonical CIP-0103 support marker.
    ...(entry.cip0103 ? { cip0103: entry.cip0103 } : {}),
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
