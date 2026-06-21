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
  TransportError,
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
 * Method verb accepted at the SDK boundary for {@link LedgerApiParams}. A
 * friendly superset: both cases are accepted because wallets diverge (Send's
 * schema requires lower-case; CIP-0103 providers use upper-case). Each adapter
 * normalizes the case to what its wallet requires — see {@link normalizeLedgerMethodUpper}.
 */
export type LedgerApiMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch';

/**
 * Ledger API proxy parameters (CIP-0103 ledgerApi method).
 *
 * This is a friendly superset so ONE call works across all wallets: the case of
 * `requestMethod` is normalized per-adapter, and `body` may be a JSON string OR
 * a plain object — each adapter coerces it to the shape its wallet requires
 * (Send wants an object; CIP-0103 providers / Loop want a JSON string).
 */
export interface LedgerApiParams {
  /** HTTP method for the JSON Ledger API (case normalized per-adapter). */
  requestMethod: LedgerApiMethod;
  /** Resource path (e.g., "/v2/state/active-contracts"). */
  resource: string;
  /** Optional JSON body — a JSON string OR a plain object (coerced per-adapter). */
  body?: string | Record<string, unknown>;
}

/**
 * Normalize a {@link LedgerApiParams} verb to LOWER-case — the canonical
 * CIP-0103 dApp API form (splice-wallet-kernel `LedgerApiRequest.requestMethod`
 * is the enum `["get","post","patch","put","delete"]`). Every `window.canton`
 * CIP-0103 RPC wallet (Send / Console / Nightly / WalletConnect / the announce
 * bridge) expects this.
 */
export function normalizeLedgerMethodLower(
  method: LedgerApiMethod,
): 'get' | 'post' | 'patch' | 'put' | 'delete' {
  return method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
}

/**
 * Coerce a {@link LedgerApiParams} body to a plain OBJECT (or `undefined`) — the
 * canonical CIP-0103 dApp API form (`LedgerApiRequest.body` is
 * `{ type: 'object' }`). An object passes through; a JSON string is parsed; a
 * non-JSON-parseable string throws.
 */
export function ledgerApiBodyToObject(
  body: string | Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (body == null) return undefined;
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new TransportError(
      'ledgerApi body must be a JSON object (or JSON-parseable string) for a CIP-0103 wallet',
    );
  }
}

/**
 * Normalize a {@link LedgerApiParams} verb to upper-case. Retained for the Bron
 * REST proxy (case-insensitive HTTP JSON API) — NOT a CIP-0103 RPC wallet; the
 * CIP-0103 wallets use {@link normalizeLedgerMethodLower}.
 */
export function normalizeLedgerMethodUpper(
  method: LedgerApiMethod,
): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
  return method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}

/**
 * Coerce a {@link LedgerApiParams} body to a JSON string (or `undefined`) — the
 * form Loop's handlers and the Bron REST proxy expect. An object is
 * `JSON.stringify`-d; a string passes through verbatim.
 */
export function ledgerApiBodyToString(
  body: string | Record<string, unknown> | undefined,
): string | undefined {
  if (body == null) return undefined;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

/**
 * Ledger API proxy result
 */
export interface LedgerApiResult {
  /** JSON response from the Ledger API */
  response: string;
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
 * 
 * Extended in 0.3.0 with optional metrics methods.
 * All new methods are optional to maintain backward compatibility.
 */
export interface TelemetryAdapter {
  /** Track a named event with optional properties */
  track(event: string, properties?: Record<string, unknown>): void;
  
  /** Track an error occurrence */
  error(error: Error, properties?: Record<string, unknown>): void;
  
  /**
   * Increment a metric counter
   * @param metric - Metric name (e.g., 'wallet_connect_attempts')
   * @param value - Value to increment by (default: 1)
   * @since 0.3.0
   */
  increment?(metric: string, value?: number): void;
  
  /**
   * Set a gauge metric value
   * @param metric - Metric name
   * @param value - Current value
   * @since 0.3.0
   */
  gauge?(metric: string, value: number): void;
  
  /**
   * Flush buffered metrics to backend
   * @since 0.3.0
   */
  flush?(): Promise<void>;
  
  /**
   * Check if telemetry is enabled
   * @returns true if telemetry should be collected
   * @since 0.3.0
   */
  isEnabled?(): boolean;
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
      /** When false, prefer remote/mobile transport over installed extension */
      preferInstalled?: boolean;
      /**
       * Called with a pairing/display URI (e.g. a WalletConnect `wc:` URI) as
       * soon as the adapter produces one, before the user approves. Lets the
       * connect UI render a QR / deep-link itself. Adapters that have no such
       * URI (their own SDK shows the QR) simply never call it.
       */
      onDisplayUri?: (uri: string) => void;
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
   * Proxy a JSON Ledger API request (optional - only if wallet supports it)
   * @param ctx Adapter context
   * @param session Active session
   * @param params Ledger API request parameters
   */
  ledgerApi?(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams
  ): Promise<LedgerApiResult>;

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
 * Structural ("duck-type") match for the official
 * `@canton-network/core-wallet-discovery` `ProviderAdapter` shape.
 *
 * We deliberately do NOT import `@canton-network/*` (mirroring the stance in
 * `@partylayer/provider`'s extension-channel) — the standard's SHAPE is the
 * contract, not its package. An app supplies a concrete instance (e.g.
 * `new WalleyAdapter()`) and the SDK bridges it generically via
 * `GenericDiscoveryAdapter`, so a popup/remote wallet that neither injects
 * `window.canton` nor announces can still be hosted by the generic layer with
 * NO wallet-specific adapter package. Any standards-compliant wallet shipping
 * this shape inherits the capability.
 *
 * `provider()` returns a `CIP0103Provider` (the official `Provider<RpcTypes>`
 * already exposes `request`/`on`/`emit`/`removeListener`); the host/network are
 * baked into the app-supplied adapter at construction, so the bridge never sees
 * or sets them.
 */
/**
 * The provider surface returned by an {@link OfficialProviderAdapter} —
 * `request` + the EventEmitter trio (`on`/`emit`/`removeListener`).
 *
 * Intentionally LOOSE (`any`-typed args): the official `@canton-network`
 * `Provider<RpcTypes>` types `request` as generic over its OWN method literals
 * (`request<M extends keyof RpcTypes>(args: RequestArgs<RpcTypes, M>)`), which
 * is NOT structurally assignable to our string-method `CIP0103Provider.request`
 * — even though it's call-compatible at runtime (the bridge only ever calls
 * `request({ method, params })`). Loosening the args lets a real official
 * adapter satisfy this shape; the bridge treats it as a `CIP0103Provider` at the
 * call site. Without this, consumers couldn't pass e.g. `new WalleyAdapter()`
 * without a cast.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OfficialProvider {
  request(args: any): Promise<any>;
  on(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): boolean;
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface OfficialProviderAdapter {
  /** Stable provider identity (e.g. "walley"). */
  readonly providerId: string;
  /** Display name (e.g. "Walley"). */
  readonly name: string;
  /** Provider transport kind, if surfaced ('browser' | 'desktop' | 'mobile' | 'remote'). */
  readonly type?: string;
  /** Branding icon (URL or data URI), if surfaced. */
  readonly icon?: string;
  /** Install/availability probe — popup-free. */
  detect(): Promise<boolean>;
  /** The live provider (request + on/emit/removeListener). */
  provider(): OfficialProvider;
  /** Optional session restore (returns a restored provider, or null). */
  restore?(): Promise<OfficialProvider | null>;
  /** Optional teardown. */
  teardown?(): void;
}

/**
 * Structural guard for {@link OfficialProviderAdapter}. Checks only the
 * required surface (`providerId` string + `detect`/`provider` functions); the
 * returned `provider()` value is separately validated against the
 * `CIP0103Provider` duck-type by the consumer.
 */
export function isOfficialProviderAdapter(
  value: unknown,
): value is OfficialProviderAdapter {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.providerId === 'string' &&
    a.providerId.length > 0 &&
    typeof a.detect === 'function' &&
    typeof a.provider === 'function'
  );
}

/**
 * Network→host mapping for a discovery-adapter wallet. This is DATA — it lives
 * in the registry entry's `adapter.networkHosts` — so the generic bridge can
 * resolve `networkHosts[activeNetwork]` with NO wallet URL hardcoded in SDK or
 * app code. A developer writes `<PartyLayerKit network="mainnet">` and the host
 * is looked up from the wallet's own entry.
 *
 * Partial: a wallet need not support every network (e.g. mainnet-only). A
 * missing key is a CLEAR failure at connect (the unsupported network is named),
 * never a silent wrong-network fallback.
 */
export type NetworkHosts = Partial<Record<NetworkId, string>>;

/**
 * Factory form of an official ProviderAdapter. Instead of a pre-constructed
 * instance with a baked host, the app supplies `create(host)` so the bridge can
 * construct the official adapter with a NETWORK-RESOLVED host at connect time.
 *
 * Why a factory and not re-hosting an instance: official adapters (e.g. Walley)
 * seal `host` at construction (`private host`, no setter), so a pre-built
 * instance cannot be re-pointed at another network's host. The factory is the
 * only clean path to network-driven host resolution.
 *
 * `create(host)` MUST be synchronous and side-effect-light (just construct the
 * adapter) — the bridge calls it on the popup-safe gesture path, so any awaited
 * work before the wallet's `window.open` would break gesture survival. The host
 * is pre-resolved during warm-up; `create` only builds the instance.
 */
export interface OfficialAdapterFactory {
  /** Stable provider identity (e.g. "walley") — matches the registry entry id / `config.providerId`. */
  readonly providerId: string;
  /** Construct the official adapter bound to `host`. Synchronous; no awaited work. */
  create(host: string): OfficialProviderAdapter;
  /** Display-name override (else the constructed adapter's `name`). */
  readonly name?: string;
  /** Icon override (else the constructed adapter's `icon`). */
  readonly icon?: string;
}

/**
 * Structural guard for {@link OfficialAdapterFactory}. Distinguishes the factory
 * form (`create` function) from a pre-constructed {@link OfficialProviderAdapter}
 * instance (`provider` function) in `config.adapters`.
 */
export function isOfficialAdapterFactory(
  value: unknown,
): value is OfficialAdapterFactory {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.providerId === 'string' &&
    a.providerId.length > 0 &&
    typeof a.create === 'function'
  );
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
