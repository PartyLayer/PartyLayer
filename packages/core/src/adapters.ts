/**
 * Wallet adapter interface contract
 * 
 * All wallet adapters must implement this interface.
 * Adapters are responsible for:
 * - Detecting wallet installation
 * - Establishing connections
 * - Signing messages/transactions
 * - Emitting events
 * 
 * References:
 * - OpenRPC dApp API spec: https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type {
  WalletId,
  PartyId,
  NetworkId,
  CapabilityKey,
  Session,
  PersistedSession,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
} from './types';
import {
  CapabilityNotSupportedError,
  WalletNotInstalledError,
} from './errors';

/**
 * Adapter detection result
 */
export interface AdapterDetectResult {
  /** Whether wallet is installed */
  installed: boolean;
  /** Reason if not installed */
  reason?: string;
}

/**
 * Adapter connection result
 */
export interface AdapterConnectResult {
  /** Connected party ID */
  partyId: PartyId;
  /** Partial session data (SDK will complete it) */
  session: Partial<Session>;
  /** Capabilities available in this session */
  capabilities: CapabilityKey[];
}

/**
 * Sign message parameters
 */
export interface SignMessageParams {
  /** Message to sign */
  message: string;
  /** Optional nonce */
  nonce?: string;
  /** Optional domain */
  domain?: string;
}

/**
 * Sign transaction parameters
 */
export interface SignTransactionParams {
  /** Transaction to sign (type kept as unknown for wallet-specific formats) */
  tx: unknown;
}

/**
 * Submit transaction parameters
 */
export interface SubmitTransactionParams {
  /** Signed transaction */
  signedTx: unknown;
}

/**
 * Logger interface
 */
export interface LoggerAdapter {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: unknown, ...args: unknown[]): void;
}

/**
 * Telemetry interface
 */
export interface TelemetryAdapter {
  track(event: string, properties?: Record<string, unknown>): void;
  error(error: Error, properties?: Record<string, unknown>): void;
}

/**
 * Crypto interface
 */
export interface CryptoAdapter {
  encrypt(data: string, key: string): Promise<string>;
  decrypt(encrypted: string, key: string): Promise<string>;
  generateKey(): Promise<string>;
}

/**
 * Storage interface
 */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Registry client interface (for adapters to query wallet info)
 */
export interface RegistryClientAdapter {
  getWallet(walletId: WalletId): Promise<unknown>;
}

/**
 * Adapter context provided to all adapter methods
 */
export interface AdapterContext {
  /** Application name */
  appName: string;
  /** Origin (for origin binding) */
  origin: string;
  /** Network */
  network: NetworkId;
  /** Logger */
  logger: LoggerAdapter;
  /** Telemetry (optional) */
  telemetry?: TelemetryAdapter;
  /** Registry client */
  registry: RegistryClientAdapter;
  /** Crypto adapter */
  crypto: CryptoAdapter;
  /** Storage adapter */
  storage: StorageAdapter;
  /** Timeout helper */
  timeout: (ms: number) => Promise<never>;
  /** Abort signal (for cancellation) */
  abortSignal?: AbortSignal;
}

/**
 * Adapter event names
 */
export type AdapterEventName =
  | 'connect'
  | 'disconnect'
  | 'sessionExpired'
  | 'txStatus'
  | 'error';

/**
 * Wallet adapter interface
 * 
 * All wallet adapters must implement this interface.
 * Optional methods (marked with ?) should only be implemented
 * if the wallet supports that capability.
 */
export interface WalletAdapter {
  /** Wallet identifier */
  readonly walletId: WalletId;
  /** Wallet display name */
  readonly name: string;

  /**
   * Get supported capabilities
   */
  getCapabilities(): CapabilityKey[];

  /**
   * Detect if wallet is installed
   */
  detectInstalled(): Promise<AdapterDetectResult>;

  /**
   * Connect to wallet
   * @param ctx Adapter context
   * @param opts Connection options (optional)
   */
  connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
    }
  ): Promise<AdapterConnectResult>;

  /**
   * Disconnect from wallet
   * @param ctx Adapter context
   * @param session Session to disconnect
   */
  disconnect(ctx: AdapterContext, session: Session): Promise<void>;

  /**
   * Restore session (optional - only if wallet supports it)
   * @param ctx Adapter context
   * @param persisted Persisted session data
   */
  restore?(
    ctx: AdapterContext,
    persisted: PersistedSession
  ): Promise<Session | null>;

  /**
   * Sign message (optional - only if wallet supports it)
   * @param ctx Adapter context
   * @param session Active session
   * @param params Sign message parameters
   */
  signMessage?(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams
  ): Promise<SignedMessage>;

  /**
   * Sign transaction (optional - only if wallet supports it)
   * @param ctx Adapter context
   * @param session Active session
   * @param params Sign transaction parameters
   */
  signTransaction?(
    ctx: AdapterContext,
    session: Session,
    params: SignTransactionParams
  ): Promise<SignedTransaction>;

  /**
   * Submit transaction (optional - only if wallet supports it)
   * @param ctx Adapter context
   * @param session Active session
   * @param params Submit transaction parameters
   */
  submitTransaction?(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams
  ): Promise<TxReceipt>;

  /**
   * Subscribe to adapter events (optional)
   * @param event Event name
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  on?(
    event: AdapterEventName,
    handler: (payload: unknown) => void
  ): () => void;
}

/**
 * Check if adapter supports required capabilities
 * Throws CapabilityNotSupportedError if not supported
 */
export function capabilityGuard(
  adapter: WalletAdapter,
  requiredCapabilities: CapabilityKey[]
): void {
  const supported = adapter.getCapabilities();
  const missing = requiredCapabilities.filter((cap) => !supported.includes(cap));

  if (missing.length > 0) {
    throw new CapabilityNotSupportedError(
      adapter.walletId,
      missing.join(', ')
    );
  }
}

/**
 * Check if wallet is installed
 * Throws WalletNotInstalledError if not installed
 */
export async function installGuard(
  adapter: WalletAdapter
): Promise<void> {
  const detect = await adapter.detectInstalled();
  if (!detect.installed) {
    throw new WalletNotInstalledError(adapter.walletId, detect.reason);
  }
}
