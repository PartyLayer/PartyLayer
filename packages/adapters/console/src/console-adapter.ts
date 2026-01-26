/**
 * Console Wallet adapter implementation
 * 
 * This adapter integrates with Console Wallet's dApp SDK.
 * Reference: https://www.npmjs.com/package/@console-wallet/dapp-sdk
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
  mapUnknownErrorToCantonConnectError,
} from '@cantonconnect/core';

/**
 * Console Wallet Provider interface
 * Based on @console-wallet/dapp-sdk and splice-wallet-kernel OpenRPC spec
 */
interface ConsoleWalletProvider {
  // OpenRPC dApp API methods
  connect: () => Promise<StatusEvent>;
  disconnect: () => Promise<void>;
  status?: () => Promise<StatusEvent>;
  signMessage?: (params: { message: string }) => Promise<{ signature: string }>;
  prepareExecute?: (params: unknown) => Promise<unknown>;
  prepareExecuteAndWait?: (params: unknown) => Promise<unknown>;
  listAccounts?: () => Promise<unknown[]>;
  getPrimaryAccount?: () => Promise<unknown>;
  // Legacy methods (for backwards compatibility)
  signTransaction?: (command: unknown) => Promise<unknown>;
  submitTransaction?: (signedTx: unknown) => Promise<string>;
  // Event handlers
  on?: (event: string, handler: (data: unknown) => void) => void;
  off?: (event: string, handler: (data: unknown) => void) => void;
}

interface StatusEvent {
  kernel: {
    id: string;
    clientType: 'browser' | 'desktop' | 'mobile' | 'remote';
    url?: string;
  };
  isConnected: boolean;
  isNetworkConnected: boolean;
  network?: {
    networkId: string;
    ledgerApi?: { baseUrl: string };
  };
  session?: {
    accessToken: string;
    userId: string;
  };
}

/**
 * Possible window property names for Console Wallet
 * Different versions might use different names
 */
const CONSOLE_WALLET_PROPERTIES = [
  'consoleWallet',
  'console',
  'canton',
  'splice',
  'spliceWallet',
  'cantonWallet',
] as const;

/**
 * Get Console Wallet provider from window
 */
function getConsoleWalletProvider(): ConsoleWalletProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as unknown as Record<string, ConsoleWalletProvider | undefined>;
  
  // Try each possible property name
  for (const prop of CONSOLE_WALLET_PROPERTIES) {
    const provider = win[prop];
    if (provider && typeof provider.connect === 'function') {
      console.log(`[ConsoleAdapter] Found Console Wallet at window.${prop}`);
      return provider;
    }
  }

  return null;
}

/**
 * Wait for Console Wallet to be injected
 * Some extensions inject asynchronously after page load
 */
async function waitForConsoleWallet(timeoutMs = 3000): Promise<ConsoleWalletProvider | null> {
  // Check if already available
  const existing = getConsoleWalletProvider();
  if (existing) {
    return existing;
  }

  // Wait for injection
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const provider = getConsoleWalletProvider();
      if (provider) {
        clearInterval(checkInterval);
        resolve(provider);
        return;
      }
      
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, 100);
  });
}


/**
 * Console Wallet adapter
 * 
 * Implements WalletAdapter interface for Console Wallet.
 * Supports connect, disconnect, signMessage, signTransaction, submitTransaction.
 */
export class ConsoleAdapter implements WalletAdapter {
  readonly walletId = toWalletId('console');
  readonly name = 'Console Wallet';

  /**
   * Get supported capabilities
   */
  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore', // Console supports basic restore (verify wallet still accessible)
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'events',
      'injected',
    ];
  }

  /**
   * Detect if Console Wallet is installed
   * 
   * Console Wallet may not inject into window until the user has:
   * 1. Installed the extension
   * 2. Completed wallet setup (Create/Import wallet)
   * 3. Connected to a network
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return {
        installed: false,
        reason: 'Browser environment required',
      };
    }

    // Wait for extension to inject (some extensions are async)
    const provider = await waitForConsoleWallet(2000);

    if (!provider) {
      // Console Wallet extension may be installed but not injecting
      // This happens when:
      // 1. User hasn't completed wallet setup
      // 2. Extension isn't enabled for this origin
      // 3. Extension isn't installed
      return {
        installed: false,
        reason: 'Console Wallet not detected. Please ensure you have: 1) Installed Console Wallet extension from https://console.digitalasset.com, 2) Completed wallet setup in the extension, 3) Connected your wallet to a network',
      };
    }

    return {
      installed: true,
      reason: 'Console Wallet detected',
    };
  }

  /**
   * Connect to Console Wallet
   * Uses OpenRPC dApp API spec: connect() -> StatusEvent
   */
  async connect(
    ctx: AdapterContext,
    _opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
    }
  ): Promise<AdapterConnectResult> {
    try {
      // Get provider
      const provider = await waitForConsoleWallet(3000);
      if (!provider) {
        throw new WalletNotInstalledError(
          this.walletId, 
          'Console Wallet extension not detected. Please install from https://console.digitalasset.com'
        );
      }

      ctx.logger.debug('Connecting to Console Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      // Connect using OpenRPC dApp API
      const statusEvent = await provider.connect();

      ctx.logger.debug('Console Wallet connect result', statusEvent);

      // Extract party ID from session or accounts
      let partyIdStr: string;
      
      if (statusEvent.session?.userId) {
        // Use session userId as party ID
        partyIdStr = statusEvent.session.userId;
      } else if (provider.getPrimaryAccount) {
        // Try to get primary account
        const account = await provider.getPrimaryAccount();
        partyIdStr = (account as { partyId?: string })?.partyId || 'unknown';
      } else {
        // Fallback
        partyIdStr = `party-${Date.now()}`;
      }

      const partyId = toPartyId(partyIdStr);
      const networkId = statusEvent.network?.networkId || ctx.network;

      // Return connection result
      return {
        partyId,
        session: {
          walletId: this.walletId,
          network: networkId,
          createdAt: Date.now(),
          metadata: {
            kernelId: statusEvent.kernel?.id,
            clientType: statusEvent.kernel?.clientType,
          },
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'injected',
        details: {
          origin: ctx.origin,
          network: ctx.network,
        },
      });
    }
  }

  /**
   * Disconnect from Console Wallet
   */
  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    try {
      const provider = getConsoleWalletProvider();
      if (provider) {
        await provider.disconnect();
      }

      ctx.logger.debug('Disconnected from Console Wallet', {
        sessionId: session.sessionId,
      });
    } catch (err) {
      // Log but don't throw - disconnect should be best-effort
      ctx.logger.warn('Error during Console Wallet disconnect', err);
    }
  }

  /**
   * Restore session
   * 
   * Console Wallet sessions are typically long-lived while the extension is active.
   * We attempt to verify the connection is still valid by checking status.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession
  ): Promise<Session | null> {
    try {
      // Check if Console Wallet is still installed
      const provider = getConsoleWalletProvider();
      if (!provider) {
        return null;
      }

      // Check if session is expired
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      // Try to get current status
      if (provider.status) {
        try {
          const status = await provider.status();
          if (!status.isConnected) {
            ctx.logger.debug('Console Wallet not connected, cannot restore');
            return null;
          }
        } catch {
          // Status check failed, try to restore anyway
        }
      }
      
      ctx.logger.debug('Restored Console Wallet session', {
        sessionId: persisted.sessionId,
        partyId: persisted.partyId,
      });

      // Return restored session
      return {
        ...persisted,
        walletId: this.walletId,
      };
    } catch (err) {
      ctx.logger.warn('Failed to restore Console Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message using OpenRPC signMessage method
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams
  ): Promise<SignedMessage> {
    try {
      const provider = getConsoleWalletProvider();
      if (!provider) {
        throw new WalletNotInstalledError(this.walletId, 'Console Wallet not available');
      }

      if (!provider.signMessage) {
        throw new Error('Console Wallet does not support signMessage');
      }

      ctx.logger.debug('Signing message with Console Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
      });

      // Use OpenRPC signMessage format
      const result = await provider.signMessage({ message: params.message });

      return {
        signature: toSignature(result.signature),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'injected',
        details: {
          sessionId: session.sessionId,
        },
      });
    }
  }

  /**
   * Sign a transaction using prepareExecute
   */
  async signTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SignTransactionParams
  ): Promise<SignedTransaction> {
    try {
      const provider = getConsoleWalletProvider();
      if (!provider) {
        throw new WalletNotInstalledError(this.walletId, 'Console Wallet not available');
      }

      ctx.logger.debug('Signing transaction with Console Wallet', {
        sessionId: session.sessionId,
      });

      let signedTx: unknown;
      
      // Use prepareExecute if available (OpenRPC spec)
      if (provider.prepareExecute) {
        signedTx = await provider.prepareExecute(params.tx);
      } else if (provider.signTransaction) {
        // Fallback to legacy method
        signedTx = await provider.signTransaction(params.tx);
      } else {
        throw new Error('Console Wallet does not support transaction signing');
      }

      const transactionHash = toTransactionHash(
        `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      );

      return {
        signedTx,
        transactionHash,
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'signTransaction',
        transport: 'injected',
        details: {
          sessionId: session.sessionId,
        },
      });
    }
  }

  /**
   * Submit a transaction using prepareExecuteAndWait
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams
  ): Promise<TxReceipt> {
    try {
      const provider = getConsoleWalletProvider();
      if (!provider) {
        throw new WalletNotInstalledError(this.walletId, 'Console Wallet not available');
      }

      ctx.logger.debug('Submitting transaction with Console Wallet', {
        sessionId: session.sessionId,
      });

      let result: { tx?: { payload?: { updateId?: string } } } | string;
      
      // Use prepareExecuteAndWait if available (OpenRPC spec)
      if (provider.prepareExecuteAndWait) {
        result = await provider.prepareExecuteAndWait(params.signedTx) as { tx?: { payload?: { updateId?: string } } };
        const updateId = result?.tx?.payload?.updateId || `tx_${Date.now()}`;
        return {
          transactionHash: toTransactionHash(updateId),
          submittedAt: Date.now(),
        };
      } else if (provider.submitTransaction) {
        // Fallback to legacy method
        const txHash = await provider.submitTransaction(params.signedTx);
        return {
          transactionHash: toTransactionHash(txHash),
          submittedAt: Date.now(),
        };
      } else {
        throw new Error('Console Wallet does not support transaction submission');
      }
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'injected',
        details: {
          sessionId: session.sessionId,
        },
      });
    }
  }

  /**
   * Subscribe to adapter events (if Console SDK supports it)
   */
  on(
    event: 'connect' | 'disconnect' | 'sessionExpired' | 'txStatus' | 'error',
    handler: (payload: unknown) => void
  ): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const provider = getConsoleWalletProvider();

    // If Console SDK supports events, wire them up
    if (provider?.on) {
      provider.on(event, handler);
      return () => {
        provider.off?.(event, handler);
      };
    }

    // Otherwise return no-op unsubscribe
    return () => {};
  }
}
