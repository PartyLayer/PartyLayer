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
 * - 'combined' — Auto-detects: extension if installed, otherwise QR/deep link
 *
 * Note: In 'combined' mode, the adapter resolves to 'local' or 'remote'
 * explicitly rather than passing 'combined' to the SDK, because the SDK's
 * combined mode shows its own connector-selection UI which conflicts with
 * PartyLayer's modal.
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
// Lazy, browser-only access to the Console Wallet SDK. A static VALUE import
// would eagerly init the SDK's localforage storage at module load, which throws
// "No available storage method found" on the server (SSR). Loading it lazily on
// first use (client-side) keeps `import '@partylayer/adapter-console'` SSR-safe.
// The `typeof import(...)` below is a TYPE position only (erased at build) and
// does not trigger the eager load.
type ConsoleWalletApi = (typeof import('@console-wallet/dapp-sdk'))['consoleWallet'];
let consoleWalletPromise: Promise<ConsoleWalletApi> | undefined;
function getConsoleWallet(): Promise<ConsoleWalletApi> {
  if (!consoleWalletPromise) {
    consoleWalletPromise = import('@console-wallet/dapp-sdk').then((m) => m.consoleWallet);
  }
  return consoleWalletPromise;
}

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

    // 'local' target: extension-only — answer matches the postMessage probe.
    if (this.target === 'local') {
      return this.detectExtension();
    }

    // 'remote' target: QR / deep-link only — there is no local install to
    // detect. Report `installed: false` so the picker accurately reflects
    // "extension not present"; connect() handles the QR / deep-link flow
    // when invoked. The contract is: detectInstalled() answers "is the
    // local install present?", not "is the wallet reachable somehow?".
    if (this.target === 'remote') {
      return {
        installed: false,
        reason:
          'Console Wallet (remote target): no local install — connect() opens QR / deep link flow',
      };
    }

    // 'combined' target: extension is the primary medium. If the extension
    // is present, that's an unambiguous "installed: true". If absent, we
    // report `false` even though the QR fallback would still work at
    // connect() time. This keeps the green-dot/grey-dot UX truthful for
    // users who read "Ready" as "extension installed". The fallback flow
    // remains intact: connect() in combined mode falls through to remote
    // (QR) when checkExtensionAvailability() reports notInstalled — see
    // the connect() implementation below.
    return this.detectExtension();
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
    _opts?: { timeoutMs?: number; partyId?: PartyId; preferInstalled?: boolean },
  ): Promise<AdapterConnectResult> {
    const transportLabel = resolveTransportLabel(this.target, null);

    try {
      // Resolve the effective SDK target.
      // We never pass 'combined' to the SDK because its combined mode shows
      // a connector-selection UI inside #console-wallet-connect-placeholder
      // which conflicts with our modal. Instead, we detect the extension
      // ourselves and pick 'local' or 'remote' explicitly.
      let effectiveTarget: 'local' | 'remote';

      if (this.target === 'local') {
        const availability =
          await (await getConsoleWallet()).checkExtensionAvailability();
        if (availability.status !== 'installed') {
          throw new WalletNotInstalledError(
            this.walletId,
            'Console Wallet extension not detected. Install from https://consolewallet.io',
          );
        }
        effectiveTarget = 'local';
      } else if (this.target === 'remote') {
        effectiveTarget = 'remote';
      } else {
        // Combined: detect extension and pick the right path.
        // If preferInstalled is explicitly false (e.g. "Try mobile" fallback),
        // force remote mode regardless of extension availability.
        if (_opts?.preferInstalled === false) {
          effectiveTarget = 'remote';
        } else {
          let extensionAvailable = false;
          try {
            const availability =
              await (await getConsoleWallet()).checkExtensionAvailability();
            extensionAvailable = availability.status === 'installed';
          } catch {
            extensionAvailable = false;
          }
          effectiveTarget = extensionAvailable ? 'local' : 'remote';
        }
      }

      ctx.logger.debug('Connecting to Console Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
        target: this.target,
        effectiveTarget,
      });

      // Connect with the resolved target — always 'local' or 'remote', never 'combined'
      const connectResult = await (await getConsoleWallet()).connect({
        name: ctx.appName,
        icon: ctx.origin ? `${ctx.origin}/favicon.ico` : undefined,
        target: effectiveTarget,
      });

      ctx.logger.debug('Console Wallet connect result', connectResult);

      if (!connectResult.isConnected) {
        throw new Error(
          connectResult.reason || 'Console Wallet connection was rejected',
        );
      }

      // Transport is known from the effective target
      this.activeTransport = effectiveTarget === 'local' ? 'injected' : 'remote';

      ctx.logger.debug('Console Wallet active transport', {
        target: this.target,
        activeTransport: this.activeTransport,
      });

      // Get primary account for party ID
      const account = await (await getConsoleWallet()).getPrimaryAccount();
      const partyIdStr = account?.partyId || `party-${Date.now()}`;

      // Get active network
      let networkId = ctx.network;
      try {
        const network = await (await getConsoleWallet()).getActiveNetwork();
        if (network?.id) networkId = network.id;
      } catch {
        // Network query failed — use context network
      }

      // Get status for provider info
      let providerId: string | undefined;
      let providerType: string | undefined;
      try {
        const status = await (await getConsoleWallet()).status();
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
      await (await getConsoleWallet()).disconnect();
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
          await (await getConsoleWallet()).checkExtensionAvailability();
        if (availability.status !== 'installed') return null;
      }

      // isConnected() checks both extension and relay session state
      const connectStatus = await (await getConsoleWallet()).isConnected();
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
            await (await getConsoleWallet()).checkExtensionAvailability();
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

      const result = await (await getConsoleWallet()).signMessage({
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
      const result = await (await getConsoleWallet()).submitCommands(
        params.tx as Parameters<ConsoleWalletApi['submitCommands']>[0],
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

      const txData = params.signedTx as Parameters<ConsoleWalletApi['submitCommands']>[0];
      const result = await (await getConsoleWallet()).submitCommands({
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
      const wallet = (await getConsoleWallet()) as unknown as {
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
        // Defer the subscription via the cached SDK import (browser-only). The
        // unsubscribe stays a synchronous no-op — signature unchanged.
        void getConsoleWallet().then((cw) =>
          cw.onConnectionStatusChanged((status) => {
            handler(status);
          }),
        );
        return () => {};

      case 'txStatus':
        void getConsoleWallet().then((cw) =>
          cw.onTxStatusChanged((txEvent) => {
            handler(txEvent);
          }),
        );
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
        await (await getConsoleWallet()).checkExtensionAvailability();

      if (availability.status === 'installed') {
        return {
          installed: true,
          reason: `Console Wallet detected${availability.currentVersion ? ` (v${availability.currentVersion})` : ''}`,
        };
      }

      return {
        installed: false,
        reason:
          'Console Wallet extension not detected. Install from https://consolewallet.io',
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
