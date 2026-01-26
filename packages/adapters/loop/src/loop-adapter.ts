/**
 * 5N Loop Wallet adapter implementation
 * 
 * This adapter integrates with Loop SDK.
 * Reference: https://github.com/fivenorth-io/loop-sdk
 * 
 * Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 * Signing transactions from dApps: https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  Session,
  PersistedSession,
  CapabilityKey,
  PartyId,
} from '@cantonconnect/core';
import {
  toWalletId,
  toPartyId,
  toTransactionHash,
  toSignature,
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  mapUnknownErrorToCantonConnectError,
} from '@cantonconnect/core';

/**
 * Loop SDK CDN URLs to try
 * We try multiple CDNs in case one is down
 */
const LOOP_SDK_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@fivenorth/loop-sdk@0.8.0/dist/index.js',
  'https://unpkg.com/@fivenorth/loop-sdk@0.8.0/dist/index.js',
];

/**
 * Track if Loop SDK is being loaded
 */
let loopSDKLoadPromise: Promise<void> | null = null;
let loopSDKLoaded = false;

/**
 * Dynamically load Loop SDK from CDN
 * This allows dApps to use Loop without installing the SDK themselves
 * 
 * The Loop SDK is an ESM module that exports to window.loop when loaded
 */
async function loadLoopSDK(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Loop SDK requires browser environment');
  }

  // Check if already loaded
  if (loopSDKLoaded || (window as unknown as { loop?: LoopSDK }).loop) {
    loopSDKLoaded = true;
    return;
  }

  // If already loading, wait for it
  if (loopSDKLoadPromise) {
    return loopSDKLoadPromise;
  }

  // Try loading from CDN with module script
  loopSDKLoadPromise = (async () => {
    let lastError: Error | null = null;
    
    for (const cdnUrl of LOOP_SDK_CDN_URLS) {
      try {
        // Try dynamic import first (for ESM modules)
        const module = await import(/* @vite-ignore */ cdnUrl);
        
        // Check if module exports loop
        if (module.loop || module.default?.loop) {
          const loopObj = module.loop || module.default?.loop || module.default;
          (window as unknown as { loop: LoopSDK }).loop = loopObj;
          loopSDKLoaded = true;
          console.log('[LoopAdapter] Successfully loaded Loop SDK from:', cdnUrl);
          return;
        }
        
        // Check if it was set on window
        if ((window as unknown as { loop?: LoopSDK }).loop) {
          loopSDKLoaded = true;
          console.log('[LoopAdapter] Loop SDK loaded to window.loop from:', cdnUrl);
          return;
        }
      } catch (err) {
        console.warn('[LoopAdapter] Failed to load from', cdnUrl, err);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    
    // If dynamic import failed, try script tag approach
    try {
      await loadLoopSDKViaScript(LOOP_SDK_CDN_URLS[0]);
      if ((window as unknown as { loop?: LoopSDK }).loop) {
        loopSDKLoaded = true;
        return;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    
    loopSDKLoadPromise = null;
    throw lastError || new Error('Failed to load Loop SDK from all CDN sources');
  })();

  return loopSDKLoadPromise;
}

/**
 * Load Loop SDK via script tag (fallback method)
 */
function loadLoopSDKViaScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.type = 'module';
    script.async = true;
    script.onload = () => {
      // Give the module time to execute
      setTimeout(() => {
        if ((window as unknown as { loop?: LoopSDK }).loop) {
          resolve();
        } else {
          reject(new Error('Loop SDK script loaded but window.loop not found'));
        }
      }, 100);
    };
    script.onerror = () => {
      reject(new Error('Failed to load Loop SDK script'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Loop SDK types
 * Based on @fivenorth/loop-sdk API
 */
interface LoopSDK {
  init: (config: {
    appName: string;
    network: 'local' | 'devnet' | 'mainnet';
    onTransactionUpdate?: (payload: unknown) => void;
    options?: {
      openMode?: 'popup' | 'tab';
      requestSigningMode?: 'popup' | 'tab';
      redirectUrl?: string;
    };
    onAccept: (provider: LoopProvider) => void;
    onReject: () => void;
  }) => void;
  connect: () => void;
  wallet?: {
    transfer?: unknown;
    extension?: {
      usdcBridge?: unknown;
    };
  };
}

interface LoopProvider {
  party_id: string;
  signMessage: (message: string) => Promise<string>;
  submitTransaction: (command: unknown, options?: {
    message?: string;
    estimateTraffic?: boolean;
  }) => Promise<{
    command_id: string;
    submission_id: string;
  }>;
  submitAndWaitForTransaction?: (command: unknown, options?: {
    message?: string;
  }) => Promise<unknown>;
  getHolding?: () => Promise<unknown>;
  getActiveContracts?: (params: {
    templateId?: string;
    interfaceId?: string;
  }) => Promise<unknown>;
}

/**
 * Loop Wallet adapter
 * 
 * Implements WalletAdapter interface for 5N Loop Wallet.
 * Supports connect, disconnect, signMessage, submitTransaction.
 * 
 * Note: Loop SDK uses QR code/popup flow for connection.
 * Sessions are ephemeral and cannot be restored.
 */
export class LoopAdapter implements WalletAdapter {
  readonly walletId = toWalletId('loop');
  readonly name = '5N Loop';

  private currentProvider: LoopProvider | null = null;

  /**
   * Get Loop SDK instance
   * Loads from window.loop or global loop if available
   */
  private getLoopSDK(): LoopSDK | null {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check for Loop SDK on window (if loaded via script tag)
    const windowLoop = (window as unknown as { loop?: LoopSDK }).loop;
    if (windowLoop) {
      return windowLoop;
    }

    // Check for global loop (if imported as module)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalLoop = (globalThis as any).loop;
    if (globalLoop) {
      return globalLoop;
    }

    return null;
  }

  /**
   * Get supported capabilities
   */
  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'signMessage',
      'submitTransaction',
      'events',
      'popup',
    ];
  }

  /**
   * Detect if Loop SDK is available
   * 
   * Loop SDK is automatically loaded from CDN when needed.
   * Since Loop uses QR/popup flow, "installed" always returns true in browser.
   * The actual wallet connection happens via QR code scan or popup.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return {
        installed: false,
        reason: 'Browser environment required',
      };
    }

    // Loop SDK will be lazy-loaded when connect() is called
    // So we always return true in browser environment
    return {
      installed: true,
      reason: 'Loop Wallet available via QR code scan or popup.',
    };
  }

  /**
   * Connect to Loop Wallet
   * 
   * Loop SDK uses a QR code/popup flow:
   * 1. Lazy-load Loop SDK from CDN (if not already loaded)
   * 2. Initialize SDK with app name and network
   * 3. Call connect() which opens QR code modal
   * 4. User scans QR code with Loop mobile app or approves in popup
   * 5. onAccept callback receives provider with party_id
   */
  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
    }
  ): Promise<AdapterConnectResult> {
    try {
      if (typeof window === 'undefined') {
        throw new WalletNotInstalledError(this.walletId, 'Browser environment required');
      }

      ctx.logger.debug('Loading Loop SDK...', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      // Lazy-load Loop SDK from CDN
      try {
        await loadLoopSDK();
      } catch (err) {
        throw new WalletNotInstalledError(
          this.walletId, 
          `Failed to load Loop SDK: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }

      const loopSDK = this.getLoopSDK();
      if (!loopSDK) {
        throw new WalletNotInstalledError(this.walletId, 'Loop SDK not available after loading');
      }

      ctx.logger.debug('Connecting to Loop Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      // Map network (Loop uses 'local' | 'devnet' | 'mainnet')
      const loopNetwork = this.mapNetworkToLoop(ctx.network);

      return new Promise<AdapterConnectResult>((resolve, reject) => {
        let resolved = false;
        const timeout = opts?.timeoutMs || 300000; // 5 minutes default for QR scan

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Connection timeout - user did not complete QR scan'));
          }
        }, timeout);

        // Initialize Loop SDK
        loopSDK.init({
          appName: ctx.appName,
          network: loopNetwork,
          onTransactionUpdate: (payload) => {
            // Forward transaction updates if adapter.on() is called
            ctx.logger.debug('Loop transaction update', payload);
          },
          options: {
            openMode: 'popup',
            requestSigningMode: 'popup',
          },
          onAccept: (provider: LoopProvider) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);

            this.currentProvider = provider;
            const partyId = toPartyId(provider.party_id);

            ctx.logger.info('Connected to Loop Wallet', {
              partyId: provider.party_id,
            });

            resolve({
              partyId,
              session: {
                walletId: this.walletId,
                network: ctx.network,
                createdAt: Date.now(),
                // Loop sessions are ephemeral
              },
              capabilities: this.getCapabilities(),
            });
          },
          onReject: () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            reject(new Error('User rejected connection'));
          },
        });

        // Initiate connection (opens QR code modal)
        loopSDK.connect();
      });
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'popup',
        details: {
          origin: ctx.origin,
          network: ctx.network,
        },
      });
    }
  }

  /**
   * Disconnect from Loop Wallet
   */
  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    // Loop SDK doesn't have explicit disconnect
    // Just clear the provider
    this.currentProvider = null;
  }

  /**
   * Restore session
   * 
   * Loop sessions are ephemeral and require QR code scan for each connection.
   * However, if the Loop SDK provider is still active (user hasn't disconnected),
   * we can attempt to restore using the existing provider.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession
  ): Promise<Session | null> {
    try {
      // Check if Loop SDK is available
      const detect = await this.detectInstalled();
      if (!detect.installed) {
        return null;
      }

      // Check if session is expired
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      // Check if we still have an active provider
      // (This would require Loop SDK to expose a way to check active connection)
      // For now, Loop doesn't support restoration - user must reconnect
      // This is documented limitation
      
      ctx.logger.debug('Loop Wallet does not support session restoration', {
        sessionId: persisted.sessionId,
      });

      return null; // Loop requires reconnection via QR code
    } catch (err) {
      ctx.logger.warn('Failed to restore Loop Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams
  ): Promise<SignedMessage> {
    try {
      if (!this.currentProvider) {
        throw new Error('Not connected to Loop Wallet');
      }

      ctx.logger.debug('Signing message with Loop Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
      });

      const signature = await this.currentProvider.signMessage(params.message);

      return {
        signature: toSignature(signature),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'popup',
        details: {
          sessionId: session.sessionId,
        },
      });
    }
  }

  /**
   * Sign a transaction
   * 
   * Note: Loop SDK's submitTransaction signs and submits in one call.
   * For signing only, we'd need to use Loop's internal APIs which may not be exposed.
   * For now, we throw CapabilityNotSupportedError.
   */
  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(
      this.walletId,
      'signTransaction - Loop SDK combines signing and submission. Use submitTransaction instead.'
    );
  }

  /**
   * Submit a transaction
   * 
   * Loop SDK's submitTransaction signs and submits the transaction.
   * It returns command_id and submission_id.
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams
  ): Promise<TxReceipt> {
    try {
      if (!this.currentProvider) {
        throw new Error('Not connected to Loop Wallet');
      }

      ctx.logger.debug('Submitting transaction with Loop Wallet', {
        sessionId: session.sessionId,
      });

      // Loop SDK's submitTransaction takes a DAML command and signs/submits it
      // params.signedTx should be the DAML command structure
      const result = await this.currentProvider.submitTransaction(params.signedTx, {
        message: 'Submit transaction via CantonConnect',
      });

      // Use command_id as transaction hash
      const transactionHash = toTransactionHash(result.command_id);

      return {
        transactionHash,
        submittedAt: Date.now(),
        commandId: result.command_id,
        updateId: result.submission_id,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'popup',
        details: {
          sessionId: session.sessionId,
        },
      });
    }
  }

  /**
   * Map network ID to Loop SDK network format
   */
  private mapNetworkToLoop(network: string): 'local' | 'devnet' | 'mainnet' {
    if (network === 'local') return 'local';
    if (network === 'devnet' || network === 'testnet') return 'devnet';
    return 'mainnet';
  }
}
