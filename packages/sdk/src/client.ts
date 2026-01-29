/**
 * CantonConnect Client - Public API Implementation
 * 
 * This is the main public API for CantonConnect SDK.
 * All dApps should use this API exclusively.
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 * - Signing transactions from dApps: https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html
 * - OpenRPC dApp API spec: https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json
 */

import type {
  WalletId,
  SessionId,
  CapabilityKey,
  WalletInfo,
  Session,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  WalletAdapter,
  AdapterContext,
} from '@cantonconnect/core';
import {
  toSessionId,
  WalletNotFoundError,
  CapabilityNotSupportedError,
  mapUnknownErrorToCantonConnectError,
  capabilityGuard,
  installGuard,
} from '@cantonconnect/core';
import { RegistryClient } from '@cantonconnect/registry-client';
import type { RegistryStatus } from '@cantonconnect/registry-client';
import {
  DEFAULT_REGISTRY_URL,
  type CantonConnectConfig,
  type ConnectOptions,
  type WalletFilter,
} from './config';
import type {
  CantonConnectEvent,
  EventHandler,
} from './events';
import {
  DefaultLogger,
  DefaultCrypto,
  DefaultStorage,
  DefaultTelemetry,
} from './adapters';
import { getBuiltinAdapters } from './builtin-adapters';
import type {
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
} from '@cantonconnect/core';

/**
 * CantonConnect Client
 * 
 * Main client interface for dApps to interact with Canton wallets.
 */
export class CantonConnectClient {
  private config: CantonConnectConfig;
  private adapters = new Map<WalletId, WalletAdapter>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private activeSession: Session | null = null;
  public readonly registryClient: RegistryClient; // Expose for React hooks
  private logger: import('@cantonconnect/core').LoggerAdapter;
  private crypto: import('@cantonconnect/core').CryptoAdapter;
  private storage: import('@cantonconnect/core').StorageAdapter;
  private telemetry?: import('@cantonconnect/core').TelemetryAdapter;
  private origin: string;

  constructor(config: CantonConnectConfig) {
    this.config = config;

    // Determine origin
    if (config.app.origin) {
      this.origin = config.app.origin;
    } else if (typeof window !== 'undefined') {
      this.origin = window.location.origin;
    } else {
      this.origin = 'unknown';
    }

    // Initialize service adapters
    this.logger = config.logger || new DefaultLogger();
    this.crypto = config.crypto || new DefaultCrypto();
    this.storage = config.storage || new DefaultStorage();
    this.telemetry = config.telemetry || new DefaultTelemetry();

    // Register wallet adapters
    // If no adapters provided, use all built-in adapters (Console, Loop, etc.)
    const adaptersToRegister = config.adapters ?? getBuiltinAdapters();
    
    for (const adapterOrClass of adaptersToRegister) {
      let adapter: import('@cantonconnect/core').WalletAdapter;
      
      // Check if it's a class (function) or instance (object)
      if (typeof adapterOrClass === 'function') {
        // It's a class - instantiate it
        adapter = new (adapterOrClass as new () => import('@cantonconnect/core').WalletAdapter)();
      } else {
        // It's already an instance
        adapter = adapterOrClass;
      }
      
      this.adapters.set(adapter.walletId, adapter);
      this.logger.debug('Registered wallet adapter', {
        walletId: adapter.walletId,
        name: adapter.name,
        capabilities: adapter.getCapabilities(),
      });
    }

    // Initialize registry client with signature verification
    this.registryClient = new RegistryClient({
      registryUrl: config.registryUrl || DEFAULT_REGISTRY_URL,
      channel: config.channel || 'stable',
      registryPublicKeys: config.registryPublicKeys,
      storage: this.storage,
    });

    // Emit initial registry status
    this.updateRegistryStatus();

    // Restore session on init
    this.restoreSession().catch((err) => {
      this.emit('error', {
        type: 'error',
        error: mapUnknownErrorToCantonConnectError(err, {
          phase: 'restore',
        }),
      });
    });
  }

  /**
   * Register a wallet adapter
   * 
   * @internal
   * This is used internally by the SDK to register adapters.
   * In production, adapters would be auto-registered via registry.
   */
  registerAdapter(adapter: WalletAdapter): void {
    this.adapters.set(adapter.walletId, adapter);
  }

  /**
   * List available wallets
   */
  async listWallets(filter?: WalletFilter): Promise<WalletInfo[]> {
    try {
      // getWallets() already returns WalletInfo[]
      const allWalletInfos = await this.registryClient.getWallets();

      // Update registry status after successful fetch
      this.updateRegistryStatus();

      // Filter by capabilities
      if (filter?.requiredCapabilities) {
        return allWalletInfos.filter((walletInfo) =>
          filter.requiredCapabilities!.every((cap) =>
            walletInfo.capabilities.includes(cap as CapabilityKey)
          )
        );
      }

      // Filter experimental
      if (!filter?.includeExperimental) {
        return allWalletInfos.filter((walletInfo) => walletInfo.channel === 'stable');
      }

      return allWalletInfos;
    } catch (err) {
      // Update registry status even on error (may have fallback info)
      this.updateRegistryStatus();
      
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'connect',
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Connect to a wallet
   */
  async connect(options?: ConnectOptions): Promise<Session> {
    try {
      // Get available wallets
      const wallets = await this.listWallets({
        requiredCapabilities: options?.requiredCapabilities,
        includeExperimental: true,
      });

      // Filter by allowWallets
      let availableWallets = wallets;
      if (options?.allowWallets) {
        availableWallets = wallets.filter((w) =>
          options.allowWallets!.includes(w.walletId)
        );
      }

      // Prefer installed wallets
      if (options?.preferInstalled) {
        const installedWallets: WalletInfo[] = [];
        const notInstalledWallets: WalletInfo[] = [];

        for (const wallet of availableWallets) {
          const adapter = this.adapters.get(wallet.walletId);
          if (adapter) {
            const detect = await adapter.detectInstalled();
            if (detect.installed) {
              installedWallets.push(wallet);
            } else {
              notInstalledWallets.push(wallet);
            }
          } else {
            notInstalledWallets.push(wallet);
          }
        }

        availableWallets = [...installedWallets, ...notInstalledWallets];
      }

      // Select wallet
      let selectedWallet: WalletInfo;
      if (options?.walletId) {
        selectedWallet = availableWallets.find(
          (w) => w.walletId === options.walletId
        )!;
        if (!selectedWallet) {
          throw new WalletNotFoundError(String(options.walletId));
        }
      } else if (availableWallets.length === 0) {
        throw new WalletNotFoundError('No wallets available');
      } else {
        selectedWallet = availableWallets[0];
      }

      // Get adapter
      const adapter = this.adapters.get(selectedWallet.walletId);
      if (!adapter) {
        throw new WalletNotFoundError(String(selectedWallet.walletId));
      }

      // Check origin allowlist (if configured)
      const walletEntry = await this.registryClient.getWalletEntry(String(selectedWallet.walletId));
      if (walletEntry.originAllowlist && walletEntry.originAllowlist.length > 0) {
        if (!walletEntry.originAllowlist.includes(this.origin)) {
          const { OriginNotAllowedError } = await import('@cantonconnect/core');
          throw new OriginNotAllowedError(
            this.origin,
            walletEntry.originAllowlist
          );
        }
      }

      // Check capabilities
      if (options?.requiredCapabilities) {
        capabilityGuard(adapter, options.requiredCapabilities as CapabilityKey[]);
      }

      // Check installation
      await installGuard(adapter);

      // Create adapter context
      const ctx = this.createAdapterContext();

      // Connect
      // Default timeout: 2 minutes for QR code/popup based wallets
      const timeoutMs = options?.timeoutMs || 120000;
      const connectPromise = adapter.connect(ctx, {
        timeoutMs,
        partyId: undefined, // TODO: support party selection
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timed out after ${timeoutMs}ms - user did not complete wallet connection`));
        }, timeoutMs);
      });

      const result = await Promise.race([connectPromise, timeoutPromise]);

      // Create session
      const session: Session = {
        sessionId: toSessionId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`),
        walletId: selectedWallet.walletId,
        partyId: result.partyId,
        network: this.config.network,
        createdAt: Date.now(),
        expiresAt: result.session.expiresAt,
        origin: this.origin,
        capabilitiesSnapshot: result.capabilities,
        metadata: result.session.metadata as Record<string, string> | undefined,
      };

      // Persist session
      await this.persistSession(session);

      // Set active session
      this.activeSession = session;

      // Update registry status (may have changed during fetch)
      this.updateRegistryStatus();

      // Emit event
      this.emit('session:connected', {
        type: 'session:connected',
        session,
      });

      return session;
    } catch (err) {
      const timeoutMs = options?.timeoutMs || 30000;
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'connect',
        walletId: options?.walletId ? String(options.walletId) : undefined,
        timeoutMs,
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    if (!this.activeSession) {
      return;
    }

    try {
      const adapter = this.adapters.get(this.activeSession.walletId);
      if (adapter) {
        const ctx = this.createAdapterContext();
        await adapter.disconnect(ctx, this.activeSession);
      }

      const sessionId = this.activeSession.sessionId;
      await this.removeSession(sessionId);

      this.activeSession = null;

      this.emit('session:disconnected', {
        type: 'session:disconnected',
        sessionId,
      });
    } catch (err) {
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'connect', // Use connect as default phase
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Get active session
   */
  async getActiveSession(): Promise<Session | null> {
    if (this.activeSession) {
      // Check expiration
      if (this.activeSession.expiresAt && Date.now() >= this.activeSession.expiresAt) {
        await this.disconnect();
        this.emit('session:expired', {
          type: 'session:expired',
          sessionId: this.activeSession.sessionId,
        });
        return null;
      }
      return this.activeSession;
    }

    // Try to restore from storage
    return this.restoreSession();
  }

  /**
   * Sign a message
   */
  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    const session = await this.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }

    const adapter = this.adapters.get(session.walletId);
    if (!adapter || !adapter.signMessage) {
      throw new CapabilityNotSupportedError(
        session.walletId,
        'signMessage'
      );
    }

    try {
      const ctx = this.createAdapterContext();
      return await adapter.signMessage(ctx, session, params);
    } catch (err) {
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'signMessage',
        walletId: String(session.walletId),
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(params: SignTransactionParams): Promise<SignedTransaction> {
    const session = await this.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }

    const adapter = this.adapters.get(session.walletId);
    if (!adapter || !adapter.signTransaction) {
      throw new CapabilityNotSupportedError(
        session.walletId,
        'signTransaction'
      );
    }

    try {
      const ctx = this.createAdapterContext();
      const result = await adapter.signTransaction(ctx, session, params);
      
      // Emit transaction status
      this.emit('tx:status', {
        type: 'tx:status',
        sessionId: session.sessionId,
        txId: result.transactionHash,
        status: 'pending',
        raw: result.signedTx,
      });

      return result;
    } catch (err) {
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'signTransaction',
        walletId: String(session.walletId),
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(params: SubmitTransactionParams): Promise<TxReceipt> {
    const session = await this.getActiveSession();
    if (!session) {
      throw new Error('No active session');
    }

    const adapter = this.adapters.get(session.walletId);
    if (!adapter || !adapter.submitTransaction) {
      throw new CapabilityNotSupportedError(
        session.walletId,
        'submitTransaction'
      );
    }

    try {
      const ctx = this.createAdapterContext();
      const result = await adapter.submitTransaction(ctx, session, params);

      // Emit transaction status
      this.emit('tx:status', {
        type: 'tx:status',
        sessionId: session.sessionId,
        txId: result.transactionHash,
        status: 'submitted',
        raw: result,
      });

      return result;
    } catch (err) {
      const error = mapUnknownErrorToCantonConnectError(err, {
        phase: 'submitTransaction',
        walletId: String(session.walletId),
      });
      this.emit('error', { type: 'error', error });
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  on<T extends CantonConnectEvent>(
    event: T['type'],
    handler: EventHandler<T>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from events
   */
  off<T extends CantonConnectEvent>(
    event: T['type'],
    handler: EventHandler<T>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * Destroy client and cleanup
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.activeSession = null;
  }

  /**
   * Create adapter context
   */
  private createAdapterContext(): AdapterContext {
    return {
      appName: this.config.app.name,
      origin: this.origin,
      network: this.config.network,
      logger: this.logger,
      telemetry: this.telemetry,
      registry: {
        getWallet: async (walletId: WalletId) => {
          return this.registryClient.getWallet(String(walletId));
        },
      },
      crypto: this.crypto,
      storage: this.storage,
      timeout: (ms: number) => {
        return new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), ms);
        });
      },
    };
  }


  /**
   * Persist session to storage
   */
  private async persistSession(session: Session): Promise<void> {
    try {
      const data = JSON.stringify(session);
      const encrypted = await this.crypto.encrypt(data, this.origin);
      await this.storage.set(`session_${session.sessionId}`, encrypted);
    } catch (err) {
      this.logger.warn('Failed to persist session', err);
    }
  }

  /**
   * Remove session from storage
   */
  private async removeSession(sessionId: SessionId): Promise<void> {
    try {
      await this.storage.remove(`session_${sessionId}`);
    } catch (err) {
      this.logger.warn('Failed to remove session', err);
    }
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<Session | null> {
    try {
      const encrypted = await this.storage.get('active_session');
      if (!encrypted) {
        return null;
      }

      const decrypted = await this.crypto.decrypt(encrypted, this.origin);
      const session = JSON.parse(decrypted) as Session;

      // Check expiration
      if (session.expiresAt && Date.now() >= session.expiresAt) {
        await this.removeSession(session.sessionId);
        return null;
      }

      // Check origin
      if (session.origin !== this.origin) {
        return null;
      }

      // Try to restore with adapter
      const adapter = this.adapters.get(session.walletId);
      if (adapter?.restore) {
        const ctx = this.createAdapterContext();
        const restored = await adapter.restore(ctx, {
          ...session,
          encrypted,
        });

        if (restored) {
          this.activeSession = restored;
          // Persist restored session (may have updated metadata)
          await this.persistSession(restored);
          // Emit session:connected event with reason="restore"
          this.emit('session:connected', {
            type: 'session:connected',
            session: restored,
          });
          return restored;
        } else {
          // Restore failed - clear session
          await this.removeSession(session.sessionId);
          this.emit('session:expired', {
            type: 'session:expired',
            sessionId: session.sessionId,
          });
          return null;
        }
      }

      // If restore not supported, use stored session as-is
      // (Some adapters don't support restore but session metadata is still valid)
      this.activeSession = session;
      return session;
    } catch (err) {
      this.logger.warn('Failed to restore session', err);
      return null;
    }
  }

  /**
   * Update registry status and emit event
   */
  private updateRegistryStatus(): void {
    const status = this.registryClient.getStatus();
    if (status) {
      this.emit('registry:status', {
        type: 'registry:status',
        status: {
          source: status.source,
          verified: status.verified,
          channel: status.channel,
          sequence: status.sequence,
          stale: status.stale,
          fetchedAt: status.fetchedAt,
          etag: status.etag,
          error: status.error,
        },
      });
    }
  }

  /**
   * Get registry status
   */
  getRegistryStatus(): RegistryStatus | null {
    return this.registryClient.getStatus();
  }

  /**
   * Emit event to handlers
   */
  private emit<T extends CantonConnectEvent>(
    event: T['type'],
    payload: T
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          this.logger.error('Error in event handler', err);
        }
      }
    }
  }
}

/**
 * Create CantonConnect client
 * 
 * This is the main entry point for dApps.
 * 
 * @example
 * ```typescript
 * const client = createCantonConnect({
 *   registryUrl: 'https://registry.cantonconnect.xyz',
 *   channel: 'stable',
 *   network: 'devnet',
 *   app: { name: 'My dApp' }
 * });
 * 
 * const session = await client.connect();
 * ```
 */
export function createCantonConnect(
  config: CantonConnectConfig
): CantonConnectClient {
  return new CantonConnectClient(config);
}
