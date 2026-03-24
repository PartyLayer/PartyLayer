/**
 * Console Wallet adapter implementation
 *
 * Uses the official @console-wallet/dapp-sdk which communicates with the
 * Console Wallet browser extension via window.postMessage.
 *
 * Reference: https://www.npmjs.com/package/@console-wallet/dapp-sdk
 * Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
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
  LedgerApiParams,
  LedgerApiResult,
  Session,
  PersistedSession,
  CapabilityKey,
  PartyId,
} from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toTransactionHash,
  toSignature,
  WalletNotInstalledError,
  CapabilityNotSupportedError,
  mapUnknownErrorToPartyLayerError,
} from '@partylayer/core';
import { consoleWallet } from '@console-wallet/dapp-sdk';

/**
 * Console Wallet adapter
 *
 * Implements WalletAdapter interface for Console Wallet using the official
 * dApp SDK. The SDK handles all communication with the browser extension
 * via window.postMessage — no window property injection is needed.
 */
export class ConsoleAdapter implements WalletAdapter {
  readonly walletId = toWalletId('console');
  readonly name = 'Console Wallet';

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
      'events',
      'injected',
    ];
  }

  /**
   * Detect if Console Wallet extension is installed.
   *
   * Uses the official SDK's checkExtensionAvailability() which sends a
   * postMessage and waits for the extension's response.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }

    try {
      const availability = await consoleWallet.checkExtensionAvailability();

      if (availability.status === 'installed') {
        return {
          installed: true,
          reason: `Console Wallet detected${availability.currentVersion ? ` (v${availability.currentVersion})` : ''}`,
        };
      }

      return {
        installed: false,
        reason:
          'Console Wallet extension not detected. Install from https://console.digitalasset.com',
      };
    } catch {
      // checkExtensionAvailability may timeout if extension is not present
      return {
        installed: false,
        reason:
          'Console Wallet extension not responding. Ensure it is installed and enabled.',
      };
    }
  }

  /**
   * Connect to Console Wallet.
   *
   * Calls SDK connect() which opens the extension popup for user approval,
   * then getPrimaryAccount() to get the party ID.
   */
  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId },
  ): Promise<AdapterConnectResult> {
    try {
      // Check availability first
      const availability = await consoleWallet.checkExtensionAvailability();
      if (availability.status !== 'installed') {
        throw new WalletNotInstalledError(
          this.walletId,
          'Console Wallet extension not detected. Install from https://console.digitalasset.com',
        );
      }

      ctx.logger.debug('Connecting to Console Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      // Connect — opens extension popup for user approval
      const connectResult = await consoleWallet.connect({
        name: ctx.appName,
        icon: ctx.origin ? `${ctx.origin}/favicon.ico` : undefined,
      });

      ctx.logger.debug('Console Wallet connect result', connectResult);

      if (!connectResult.isConnected) {
        throw new Error(
          connectResult.reason || 'Console Wallet connection was rejected',
        );
      }

      // Get primary account for party ID
      const account = await consoleWallet.getPrimaryAccount();
      const partyIdStr = account?.partyId || `party-${Date.now()}`;

      // Get active network
      let networkId = ctx.network;
      try {
        const network = await consoleWallet.getActiveNetwork();
        if (network?.id) networkId = network.id;
      } catch {
        // Network query failed — use context network
      }

      // Get status for provider info
      let providerId: string | undefined;
      let providerType: string | undefined;
      try {
        const status = await consoleWallet.status();
        providerId = status.provider?.id;
        providerType = status.provider?.providerType;
      } catch {
        // Status query optional
      }

      return {
        partyId: toPartyId(partyIdStr),
        session: {
          walletId: this.walletId,
          network: networkId,
          createdAt: Date.now(),
          metadata: {
            ...(providerId ? { providerId } : {}),
            ...(providerType ? { providerType } : {}),
          },
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'injected',
        details: { origin: ctx.origin, network: ctx.network },
      });
    }
  }

  /**
   * Disconnect from Console Wallet
   */
  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    try {
      await consoleWallet.disconnect();
      ctx.logger.debug('Disconnected from Console Wallet', {
        sessionId: session.sessionId,
      });
    } catch (err) {
      ctx.logger.warn('Error during Console Wallet disconnect', err);
    }
  }

  /**
   * Restore session — verify extension is still available and connected.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession,
  ): Promise<Session | null> {
    try {
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      const availability = await consoleWallet.checkExtensionAvailability();
      if (availability.status !== 'installed') return null;

      const connectStatus = await consoleWallet.isConnected();
      if (!connectStatus.isConnected) {
        ctx.logger.debug('Console Wallet not connected, cannot restore');
        return null;
      }

      ctx.logger.debug('Restored Console Wallet session', {
        sessionId: persisted.sessionId,
        partyId: persisted.partyId,
      });

      return { ...persisted, walletId: this.walletId };
    } catch (err) {
      ctx.logger.warn('Failed to restore Console Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message. Converts plain text to hex for the SDK.
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    try {
      ctx.logger.debug('Signing message with Console Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
      });

      // Convert message to hex (SDK expects { message: { hex } })
      const hex =
        '0x' +
        Array.from(new TextEncoder().encode(params.message))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      const result = await consoleWallet.signMessage({
        message: { hex },
        metaData: {
          purpose: 'sign-message',
          ...(params.domain ? { domain: params.domain } : {}),
          ...(params.nonce ? { nonce: params.nonce } : {}),
        },
      });

      const signature = result ?? '';

      return {
        signature: toSignature(String(signature)),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Sign a transaction. Uses submitCommands without waitForFinalization.
   */
  async signTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    try {
      ctx.logger.debug('Signing transaction with Console Wallet', {
        sessionId: session.sessionId,
      });

      // submitCommands is the SDK's tx signing method
      const result = await consoleWallet.submitCommands(
        params.tx as Parameters<typeof consoleWallet.submitCommands>[0],
      );

      const txHash = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      return {
        signedTx: result,
        transactionHash: toTransactionHash(txHash),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signTransaction',
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Submit a transaction. Uses submitCommands with waitForFinalization.
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      ctx.logger.debug('Submitting transaction with Console Wallet', {
        sessionId: session.sessionId,
      });

      const txData = params.signedTx as Parameters<typeof consoleWallet.submitCommands>[0];
      const result = await consoleWallet.submitCommands({
        ...txData,
        waitForFinalization: 5000,
      });

      const signature =
        result && typeof result === 'object' && 'signature' in result
          ? String(result.signature)
          : `tx_${Date.now()}`;

      return {
        transactionHash: toTransactionHash(signature),
        submittedAt: Date.now(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Proxy a Ledger API request through the Console Wallet extension.
   *
   * Console Wallet is CIP-0103 compliant and exposes ledgerApi via its SDK.
   * We check for the method at runtime to handle different SDK versions gracefully.
   */
  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    try {
      ctx.logger.debug('Proxying ledger API request via Console Wallet', {
        sessionId: session.sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
      });

      // The Console Wallet SDK may expose ledgerApi directly or via a generic
      // request() method (CIP-0103 standard).
      const wallet = consoleWallet as unknown as {
        ledgerApi?: (p: { requestMethod: string; resource: string; body?: string }) => Promise<unknown>;
        request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
      };

      if (typeof wallet.ledgerApi === 'function') {
        const result = await wallet.ledgerApi({
          requestMethod: params.requestMethod,
          resource: params.resource,
          body: params.body,
        });
        const response = result as { response?: string } | string;
        return {
          response: typeof response === 'string'
            ? response
            : (response?.response ?? JSON.stringify(response)),
        };
      }

      if (typeof wallet.request === 'function') {
        const result = await wallet.request({
          method: 'ledgerApi',
          params: {
            requestMethod: params.requestMethod,
            resource: params.resource,
            body: params.body,
          },
        });
        const response = result as { response?: string } | string;
        return {
          response: typeof response === 'string'
            ? response
            : (response?.response ?? JSON.stringify(response)),
        };
      }

      throw new CapabilityNotSupportedError(
        this.walletId,
        'ledgerApi — update Console Wallet extension to a version that supports CIP-0103 ledgerApi',
      );
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Subscribe to wallet events using the SDK's event callbacks.
   */
  on(
    event: 'connect' | 'disconnect' | 'sessionExpired' | 'txStatus' | 'error',
    handler: (payload: unknown) => void,
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    switch (event) {
      case 'connect':
      case 'disconnect':
        consoleWallet.onConnectionStatusChanged((status) => {
          handler(status);
        });
        return () => {};

      case 'txStatus':
        consoleWallet.onTxStatusChanged((txEvent) => {
          handler(txEvent);
        });
        return () => {};

      default:
        return () => {};
    }
  }
}
