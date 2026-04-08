/**
 * Console Wallet adapter implementation
 *
 * Uses the official @console-wallet/dapp-sdk which communicates with the
 * Console Wallet browser extension via window.postMessage (local mode) or
 * a relay server via QR code / deep link (remote mode).
 *
 * Connection modes:
 * - 'local'    — Browser extension only (postMessage transport)
 * - 'remote'   — Mobile wallet only (QR code / deep link via relay server)
 * - 'combined' — Auto-detects: tries extension first, falls back to mobile
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
 * Connection target for Console Wallet.
 *
 * - 'local'    — Browser extension only (postMessage)
 * - 'remote'   — Mobile wallet only (QR code / deep link relay)
 * - 'combined' — Auto-detect: extension preferred, mobile fallback (default)
 */
export type ConsoleConnectionTarget = 'local' | 'remote' | 'combined';

/**
 * Console Wallet adapter configuration
 */
export interface ConsoleAdapterConfig {
  /**
   * Connection target mode.
   *
   * - 'local'    — Extension only. Fails if extension is not installed.
   * - 'remote'   — Mobile only. Shows QR code / deep link flow.
   * - 'combined' — (Default) Tries extension, falls back to QR/deep link.
   */
  target?: ConsoleConnectionTarget;
}

/**
 * Resolve the transport label for error context and diagnostics.
 *
 * Returns a value compatible with the core error context transport type:
 * 'injected' | 'popup' | 'deeplink' | 'remote' | undefined
 *
 * For 'combined' mode with no active connection, returns undefined since
 * the actual transport is not yet determined.
 */
function resolveTransportLabel(
  target: ConsoleConnectionTarget,
  activeTransport: 'injected' | 'remote' | null,
): 'injected' | 'remote' | 'deeplink' | undefined {
  if (activeTransport) return activeTransport;
  if (target === 'local') return 'injected';
  if (target === 'remote') return 'remote';
  // Combined: transport not determined until connect succeeds
  return undefined;
}

/**
 * Console Wallet adapter
 *
 * Implements WalletAdapter interface for Console Wallet using the official
 * dApp SDK. Supports browser extension (local), mobile QR/deep link (remote),
 * and auto-detection (combined) connection modes.
 *
 * The SDK handles transport internally:
 * - Local: window.postMessage to Chrome extension
 * - Remote: HTTP relay via consolewallet.io with QR code / deep link
 * - Combined: tries extension first, shows connector choice if unavailable
 */
export class ConsoleAdapter implements WalletAdapter {
  readonly walletId = toWalletId('console');
  readonly name = 'Console Wallet';

  private readonly target: ConsoleConnectionTarget;

  /**
   * Tracks which transport was actually used for the current connection.
   * Set during connect(), cleared on disconnect().
   * - 'injected' — connected via browser extension
   * - 'remote'   — connected via relay (QR/deep link)
   * - null       — not connected
   */
  private activeTransport: 'injected' | 'remote' | null = null;

  constructor(config: ConsoleAdapterConfig = {}) {
    this.target = config.target ?? 'combined';
  }

  getCapabilities(): CapabilityKey[] {
    const base: CapabilityKey[] = [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
      'events',
    ];

    switch (this.target) {
      case 'local':
        return [...base, 'injected'];
      case 'remote':
        return [...base, 'deeplink', 'remoteSigner'];
      case 'combined':
        return [...base, 'injected', 'deeplink', 'remoteSigner'];
    }
  }

  /**
   * Detect if Console Wallet is available.
   *
   * - local:    checks for browser extension via postMessage
   * - remote:   always available (SDK provides QR/deep link flow)
   * - combined: always available (extension preferred, mobile fallback)
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }

    if (this.target === 'local') {
      return this.detectExtension();
    }

    // For 'remote' and 'combined', the wallet is always "available" because
    // the SDK can show a QR code for mobile connection.
    if (this.target === 'remote') {
      return {
        installed: true,
        reason: 'Console Wallet available via QR code / deep link',
      };
    }

    // Combined: check extension for informational purposes, but always available
    const extensionResult = await this.detectExtension();
    if (extensionResult.installed) {
      return extensionResult;
    }

    return {
      installed: true,
      reason:
        'Console Wallet available via QR code / deep link (extension not detected)',
    };
  }

  /**
   * Connect to Console Wallet.
   *
   * Passes the configured target to the SDK which handles transport selection:
   * - local: opens extension popup for user approval
   * - remote: shows QR code modal for mobile wallet scanning
   * - combined: tries extension, shows connector choice if unavailable
   */
  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId },
  ): Promise<AdapterConnectResult> {
    const transportLabel = resolveTransportLabel(this.target, null);

    try {
      // For 'local' mode, verify extension is present before attempting connect
      if (this.target === 'local') {
        const availability =
          await consoleWallet.checkExtensionAvailability();
        if (availability.status !== 'installed') {
          throw new WalletNotInstalledError(
            this.walletId,
            'Console Wallet extension not detected. Install from https://console.digitalasset.com',
          );
        }
      }

      // Determine active transport before connect for combined mode
      let extensionAvailable = false;
      if (this.target === 'combined') {
        try {
          const availability =
            await consoleWallet.checkExtensionAvailability();
          extensionAvailable = availability.status === 'installed';
        } catch {
          extensionAvailable = false;
        }
      }

      ctx.logger.debug('Connecting to Console Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
        target: this.target,
      });

      // Connect — SDK handles transport selection based on target
      const connectResult = await consoleWallet.connect({
        name: ctx.appName,
        icon: ctx.origin ? `${ctx.origin}/favicon.ico` : undefined,
        target: this.target,
      });

      ctx.logger.debug('Console Wallet connect result', connectResult);

      if (!connectResult.isConnected) {
        throw new Error(
          connectResult.reason || 'Console Wallet connection was rejected',
        );
      }

      // Determine which transport was actually used
      if (this.target === 'local') {
        this.activeTransport = 'injected';
      } else if (this.target === 'remote') {
        this.activeTransport = 'remote';
      } else {
        // Combined: if extension was available, SDK uses it; otherwise remote
        this.activeTransport = extensionAvailable ? 'injected' : 'remote';
      }

      ctx.logger.debug('Console Wallet active transport', {
        target: this.target,
        activeTransport: this.activeTransport,
      });

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
            transport: this.activeTransport,
            ...(providerId ? { providerId } : {}),
            ...(providerType ? { providerType } : {}),
          },
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      this.activeTransport = null;
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: transportLabel,
        details: { origin: ctx.origin, network: ctx.network, target: this.target },
      });
    }
  }

  /**
   * Disconnect from Console Wallet.
   *
   * The SDK's disconnect() handles cleanup for both local and remote sessions,
   * including clearing any persisted relay session from IndexedDB.
   */
  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    try {
      await consoleWallet.disconnect();
      ctx.logger.debug('Disconnected from Console Wallet', {
        sessionId: session.sessionId,
        transport: this.activeTransport,
      });
    } catch (err) {
      ctx.logger.warn('Error during Console Wallet disconnect', err);
    } finally {
      this.activeTransport = null;
    }
  }

  /**
   * Restore session — verify wallet is still connected.
   *
   * For local mode: checks extension availability and connection status.
   * For remote/combined mode: checks connection status via isConnected(),
   * which internally checks both extension and persisted relay sessions.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession,
  ): Promise<Session | null> {
    try {
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      const transportFromSession = persisted.metadata?.transport;

      if (this.target === 'local' || transportFromSession === 'injected') {
        // Local mode or session was created via extension — verify extension
        const availability =
          await consoleWallet.checkExtensionAvailability();
        if (availability.status !== 'installed') return null;
      }

      // isConnected() checks both extension and relay session state
      const connectStatus = await consoleWallet.isConnected();
      if (!connectStatus.isConnected) {
        ctx.logger.debug(
          'Console Wallet not connected, cannot restore',
          { target: this.target, transportFromSession },
        );
        return null;
      }

      // Restore active transport from session metadata
      if (transportFromSession === 'injected' || transportFromSession === 'remote') {
        this.activeTransport = transportFromSession;
      } else if (this.target === 'local') {
        this.activeTransport = 'injected';
      } else if (this.target === 'remote') {
        this.activeTransport = 'remote';
      } else {
        // Combined: infer from extension availability
        try {
          const availability =
            await consoleWallet.checkExtensionAvailability();
          this.activeTransport =
            availability.status === 'installed' ? 'injected' : 'remote';
        } catch {
          this.activeTransport = 'remote';
        }
      }

      ctx.logger.debug('Restored Console Wallet session', {
        sessionId: persisted.sessionId,
        partyId: persisted.partyId,
        transport: this.activeTransport,
      });

      return { ...persisted, walletId: this.walletId };
    } catch (err) {
      ctx.logger.warn('Failed to restore Console Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message. Converts plain text to hex for the SDK.
   *
   * Works identically for both local and remote transports — the SDK routes
   * the request to the correct transport internally.
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Signing message with Console Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
        transport,
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
        transport,
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
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Signing transaction with Console Wallet', {
        sessionId: session.sessionId,
        transport,
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
        transport,
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
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Submitting transaction with Console Wallet', {
        sessionId: session.sessionId,
        transport,
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
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Proxy a Ledger API request through the Console Wallet.
   *
   * Console Wallet is CIP-0103 compliant and exposes ledgerApi via its SDK.
   * Works through both local and remote transports.
   */
  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    const transport = resolveTransportLabel(this.target, this.activeTransport);

    try {
      ctx.logger.debug('Proxying ledger API request via Console Wallet', {
        sessionId: session.sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
        transport,
      });

      // The Console Wallet SDK may expose ledgerApi directly or via a generic
      // request() method (CIP-0103 standard).
      const wallet = consoleWallet as unknown as {
        ledgerApi?: (p: {
          requestMethod: string;
          resource: string;
          body?: string;
        }) => Promise<unknown>;
        request?: (args: {
          method: string;
          params?: unknown;
        }) => Promise<unknown>;
      };

      if (typeof wallet.ledgerApi === 'function') {
        const result = await wallet.ledgerApi({
          requestMethod: params.requestMethod,
          resource: params.resource,
          body: params.body,
        });
        const response = result as { response?: string } | string;
        return {
          response:
            typeof response === 'string'
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
          response:
            typeof response === 'string'
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
        transport,
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Subscribe to wallet events.
   *
   * The SDK's event callbacks work for both local and remote transports.
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

  /**
   * Check extension availability via the SDK's postMessage probe.
   */
  private async detectExtension(): Promise<AdapterDetectResult> {
    try {
      const availability =
        await consoleWallet.checkExtensionAvailability();

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
}
