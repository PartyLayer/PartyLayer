/**
 * Core types for PartyLayer SDK
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 * - Signing transactions from dApps: https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html
 * - OpenRPC dApp API spec: https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json
 */

/**
 * Branded string types for type safety
 */
export type WalletId = string & { readonly __brand: 'WalletId' };
export type PartyId = string & { readonly __brand: 'PartyId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TransactionHash = string & { readonly __brand: 'TransactionHash' };
export type Signature = string & { readonly __brand: 'Signature' };

/**
 * Network identifier
 * Standard networks: "devnet" | "testnet" | "mainnet"
 * Custom networks allowed as string
 */
export type NetworkId = 'devnet' | 'testnet' | 'mainnet' | (string & Record<never, never>);

/**
 * Capability keys that wallets can support
 * Based on OpenRPC dApp API capabilities
 */
export type CapabilityKey =
  | 'connect'
  | 'disconnect'
  | 'restore'
  | 'signMessage'
  | 'signTransaction'
  | 'submitTransaction'
  | 'ledgerApi'
  | 'events'
  | 'deeplink'
  | 'popup'
  | 'injected'
  | 'remoteSigner';

/**
 * Wallet installation hints for detection
 */
export interface InstallHints {
  /** Window property name (e.g., "consoleWallet") */
  injectedKey?: string;
  /** Browser extension ID */
  extensionId?: string;
  /** Deep link scheme (e.g., "loop://") */
  deepLinkScheme?: string;
  /** Script tag identifier */
  scriptTag?: string;
}

/**
 * Wallet adapter metadata
 */
export interface AdapterMetadata {
  /** NPM package name */
  packageName: string;
  /** Version range (semver) */
  versionRange: string;
}

/**
 * Provider matcher: a single rule used by `ProviderDetection.matchers`.
 *
 * Three match modes are defined; OR-combined inside a `ProviderDetection`.
 * Exact and prefix work on string fields directly; domain interprets the
 * field as a URL and tests its hostname against the registrable domain
 * (with subdomain support).
 */
export type ProviderMatcher =
  | {
      field: 'kernel.url' | 'kernel.userUrl';
      match: 'domain';
      /** Hostname or registrable domain. Subdomains are accepted. */
      value: string;
    }
  | {
      field: 'kernel.id' | 'kernel.url' | 'kernel.userUrl' | 'kernel.clientType';
      match: 'exact';
      /** One or more exact values; ANY match returns true. */
      values: string[];
    }
  | {
      field: 'kernel.id' | 'kernel.url' | 'kernel.userUrl';
      match: 'prefix';
      value: string;
    };

/**
 * Standards-first runtime detection of a CIP-0103 wallet.
 *
 * The registry stores these rules so that any current or future wallet
 * implementing `window.canton` can be identified without code changes —
 * a registry JSON update is enough.
 */
export interface ProviderDetection {
  /** Transport mechanism. Currently only 'window.canton' is supported. */
  transport: 'window.canton';
  /** OR-list of matchers. Provider matches if ANY matcher returns true. */
  matchers: ProviderMatcher[];
}

/**
 * Canonical CIP-0103 support marker.
 *
 * When `native: true`, the wallet is treated as a first-class CIP-0103
 * provider in the picker — it always appears in the "CIP-0103 NATIVE"
 * section regardless of install state, with a per-wallet readiness
 * indicator that reflects whether the wallet's `providerDetection` rules
 * matched the currently-injected `window.canton` provider.
 *
 * The field is optional; wallets that don't claim CIP-0103 support omit
 * it and continue to appear in the "AVAILABLE" section as before.
 */
export interface Cip0103Support {
  /** True if this wallet has confirmed CIP-0103 dApp API support. */
  native: boolean;
  /** Public evidence link (npm package, blog post, official statement). */
  evidence?: string;
  /** ISO date when CIP-0103 support was confirmed (informational). */
  since?: string;
}

/**
 * Wallet information from registry
 */
export interface WalletInfo {
  /** Wallet identifier */
  walletId: WalletId;
  /** Display name */
  name: string;
  /** Website URL */
  website: string;
  /** Icon URLs (different sizes) */
  icons: {
    sm?: string;
    md?: string;
    lg?: string;
  };
  /** Category (e.g., "browser", "mobile", "hardware") */
  category?: string;
  /** Supported capabilities */
  capabilities: CapabilityKey[];
  /** Installation detection hints */
  installHints?: InstallHints;
  /** Adapter package information */
  adapter: AdapterMetadata;
  /** Documentation URLs */
  docs: string[];
  /** Minimum SDK version required */
  minSdkVersion?: string;
  /** Supported networks */
  networks: NetworkId[];
  /** Registry channel */
  channel: 'stable' | 'beta';
  /** Additional metadata (e.g., originAllowlist) */
  metadata?: Record<string, string>;
  /**
   * Optional CIP-0103 runtime detection rules. When present, the picker can
   * decide whether this wallet is the currently-injected `window.canton`
   * provider and route it into the "CIP-0103 Native" section without any
   * hardcoded wallet IDs. Wallets that aren't CIP-0103-injected (e.g. Bron,
   * Cantor8 deeplink) leave this unset.
   */
  providerDetection?: ProviderDetection;
  /**
   * Canonical CIP-0103 support marker. When set with `native: true`, the
   * picker always lists the wallet in the "CIP-0103 NATIVE" section
   * regardless of install state.
   */
  cip0103?: Cip0103Support;
}

/**
 * Returns true if the wallet has been canonically marked as CIP-0103
 * native via its registry entry. The check is structural so it works on
 * both raw `RegistryWalletEntry` shapes and converted `WalletInfo`.
 */
export function isCip0103Native(entry: { cip0103?: Cip0103Support }): boolean {
  return entry?.cip0103?.native === true;
}

/**
 * Session information
 * Sessions are origin-bound and encrypted in storage
 */
export interface Session {
  /** Unique session ID */
  sessionId: SessionId;
  /** Wallet identifier */
  walletId: WalletId;
  /** Connected party ID */
  partyId: PartyId;
  /** Current network */
  network: NetworkId;
  /** Session creation timestamp */
  createdAt: number;
  /** Session expiration timestamp (if applicable) */
  expiresAt?: number;
  /** Origin of the dApp that created the session */
  origin: string;
  /** Capabilities available in this session */
  capabilitiesSnapshot: CapabilityKey[];
  /** Additional metadata (encrypted in storage) */
  metadata?: Record<string, string>;
}

/**
 * Persisted session (for restoration)
 */
export interface PersistedSession extends Session {
  /** Encrypted session data */
  encrypted: string;
}

/**
 * Signed message result
 */
export interface SignedMessage {
  /** Signature */
  signature: Signature;
  /** Party ID that signed */
  partyId: PartyId;
  /** Original message */
  message: string;
  /** Nonce used (if provided) */
  nonce?: string;
  /** Domain used (if provided) */
  domain?: string;
}

/**
 * Signed transaction result
 */
export interface SignedTransaction {
  /** Signed transaction data */
  signedTx: unknown;
  /** Transaction hash */
  transactionHash: TransactionHash;
  /** Party ID that signed */
  partyId: PartyId;
}

/**
 * Transaction receipt
 */
export interface TxReceipt {
  /** Transaction hash */
  transactionHash: TransactionHash;
  /** Submission timestamp */
  submittedAt: number;
  /** Command ID (if available) */
  commandId?: string;
  /** Update ID (if available) */
  updateId?: string;
}

/**
 * Transaction status
 */
export type TransactionStatus =
  | 'pending'
  | 'submitted'
  | 'committed'
  | 'rejected'
  | 'failed';

/**
 * Transaction status update
 */
export interface TxStatusUpdate {
  /** Session ID */
  sessionId: SessionId;
  /** Transaction ID */
  txId: TransactionHash;
  /** Current status */
  status: TransactionStatus;
  /** Raw transaction data (if available) */
  raw?: unknown;
  /** Timestamp */
  timestamp: number;
}

/**
 * Helper to create branded WalletId
 */
export function toWalletId(id: string): WalletId {
  return id as WalletId;
}

/**
 * Helper to create branded PartyId
 */
export function toPartyId(id: string): PartyId {
  return id as PartyId;
}

/**
 * Helper to create branded SessionId
 */
export function toSessionId(id: string): SessionId {
  return id as SessionId;
}

/**
 * Helper to create branded TransactionHash
 */
export function toTransactionHash(hash: string): TransactionHash {
  return hash as TransactionHash;
}

/**
 * Helper to create branded Signature
 */
export function toSignature(sig: string): Signature {
  return sig as Signature;
}
