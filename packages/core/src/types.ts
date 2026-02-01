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
