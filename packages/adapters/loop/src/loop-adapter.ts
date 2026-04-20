/**
 * 5N Loop Wallet adapter implementation
 *
 * Uses the official @fivenorth/loop-sdk NPM package which communicates
 * with Loop wallet via QR code / popup flow over WebSocket.
 *
 * Reference: https://github.com/fivenorth-io/loop-sdk
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
import { loop } from '@fivenorth/loop-sdk';
import type { LoopProvider } from '@fivenorth/loop-sdk';

/**
 * Loop Wallet adapter
 *
 * Implements WalletAdapter interface for 5N Loop Wallet using the official
 * Loop SDK. The SDK handles QR code display, WebSocket communication, and
 * popup/tab-based signing flows.
 *
 * Note: Loop sessions use WebSocket + localStorage for persistence.
 * The SDK's autoConnect() can restore sessions if the auth token is still valid.
 */
export class LoopAdapter implements WalletAdapter {
  readonly walletId = toWalletId('loop');
  readonly name = '5N Loop';

  private currentProvider: LoopProvider | null = null;

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'submitTransaction',
      'ledgerApi',
      'events',
      'popup',
    ];
  }

  /**
   * Detect if Loop SDK is available.
   *
   * Loop uses QR code / popup flow — no browser extension needed.
   * Always returns true in browser environments since the SDK is
   * bundled as a dependency.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return {
        installed: false,
        reason: 'Browser environment required',
      };
    }

    return {
      installed: true,
      reason: 'Loop Wallet available via QR code scan or popup.',
    };
  }

  /**
   * Connect to Loop Wallet.
   *
   * Flow:
   * 1. Initialize Loop SDK with app name and network
   * 2. Call connect() which first tries autoConnect (session restore)
   * 3. If no cached session, opens QR code overlay for user to scan
   * 4. User scans QR with Loop mobile app or approves in popup
   * 5. onAccept callback receives provider with party_id
   */
  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
    },
  ): Promise<AdapterConnectResult> {
    try {
      if (typeof window === 'undefined') {
        throw new WalletNotInstalledError(
          this.walletId,
          'Browser environment required',
        );
      }

      ctx.logger.debug('Connecting to Loop Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      // Map network to Loop format
      const loopNetwork = this.mapNetworkToLoop(ctx.network);

      return new Promise<AdapterConnectResult>((resolve, reject) => {
        let resolved = false;
        const timeout = opts?.timeoutMs || 300000; // 5 min default for QR scan

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(
              new Error(
                'Connection timeout — user did not complete QR scan',
              ),
            );
          }
        }, timeout);

        // Initialize and connect via the official SDK
        loop.init({
          appName: ctx.appName,
          network: loopNetwork,
          onTransactionUpdate: (payload) => {
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

        // Initiate connection (opens QR code overlay or auto-connects)
        loop.connect().catch((err) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          reject(err);
        });
      });
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
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
   * Disconnect from Loop Wallet.
   *
   * Calls the SDK's logout() which clears the session, closes
   * the WebSocket, and removes the QR overlay if visible.
   */
  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    try {
      loop.logout();
    } catch {
      // Ignore logout errors
    }
    this.currentProvider = null;
  }

  /**
   * Restore session.
   *
   * Loop SDK persists sessions in localStorage. We can attempt
   * autoConnect() to restore a valid session without showing the QR code.
   */
  async restore(
    ctx: AdapterContext,
    persisted: PersistedSession,
  ): Promise<Session | null> {
    try {
      if (typeof window === 'undefined') return null;

      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
        return null;
      }

      // Try auto-connect — the SDK checks localStorage for a valid auth token
      const loopNetwork = this.mapNetworkToLoop(persisted.network || ctx.network);

      return new Promise<Session | null>((resolve) => {
        let resolved = false;

        // 5 second timeout for auto-connect
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ctx.logger.debug(
              'Loop Wallet auto-connect timed out, session not restorable',
            );
            resolve(null);
          }
        }, 5000);

        loop.init({
          appName: ctx.appName,
          network: loopNetwork,
          onAccept: (provider: LoopProvider) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);

            this.currentProvider = provider;
            ctx.logger.debug('Restored Loop Wallet session via auto-connect', {
              partyId: provider.party_id,
            });

            resolve({ ...persisted, walletId: this.walletId });
          },
          onReject: () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          },
        });

        // autoConnect checks localStorage and reconnects if valid
        loop.autoConnect().catch(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(null);
          }
        });
      });
    } catch (err) {
      ctx.logger.warn('Failed to restore Loop Wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message.
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
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
      throw mapUnknownErrorToPartyLayerError(err, {
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
   * Sign a transaction.
   *
   * Loop SDK combines signing and submission. For sign-only,
   * throw CapabilityNotSupportedError.
   */
  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(
      this.walletId,
      'signTransaction — Loop SDK combines signing and submission. Use submitTransaction instead.',
    );
  }

  /**
   * Submit a transaction.
   *
   * Loop SDK's submitTransaction signs and submits the DAML command.
   * Returns command_id and submission_id.
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      if (!this.currentProvider) {
        throw new Error('Not connected to Loop Wallet');
      }

      ctx.logger.debug('Submitting transaction with Loop Wallet', {
        sessionId: session.sessionId,
      });

      const result = await this.currentProvider.submitTransaction(
        params.signedTx,
        {
          message: 'Submit transaction via PartyLayer',
        },
      );

      return {
        transactionHash: toTransactionHash(result.command_id),
        submittedAt: Date.now(),
        commandId: result.command_id,
        updateId: result.submission_id,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
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
   * Ledger API endpoints that Loop SDK can fulfill via native methods.
   *
   * Loop SDK does not expose a generic Ledger API proxy. Instead, it
   * provides purpose-built methods (getActiveContracts, getHolding,
   * submitTransaction, etc.) that we map to Canton Ledger API endpoints.
   *
   * Supported endpoints:
   * - POST /v2/state/acs — via getActiveContracts()
   * - POST /v2/state/active-contracts — alias for /v2/state/acs
   * - GET  /v2/state/acs/active-contracts — unfiltered, via getActiveContracts()
   * - POST /v2/commands/submit — via submitTransaction()
   * - POST /v2/commands/submit-and-wait — via submitAndWaitForTransaction()
   * - POST /v2/commands/submit-and-wait-for-transaction — alias
   *
   * Unsupported endpoints throw CapabilityNotSupportedError with a
   * message listing the supported routes.
   */
  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    try {
      if (!this.currentProvider) {
        throw new Error('Not connected to Loop Wallet');
      }

      const { requestMethod, resource, body } = params;
      const route = `${requestMethod.toUpperCase()} ${resource}`;

      ctx.logger.debug('Loop ledgerApi request', {
        sessionId: session.sessionId,
        route,
      });

      // Route to the appropriate Loop SDK method
      if (this.isAcsRoute(requestMethod, resource)) {
        return this.handleAcsQuery(body);
      }

      if (this.isSubmitRoute(requestMethod, resource)) {
        return this.handleSubmitCommand(resource, body);
      }

      // Unsupported endpoint
      throw new CapabilityNotSupportedError(
        this.walletId,
        `ledgerApi endpoint "${route}" is not supported by Loop wallet. ` +
          'Supported: POST /v2/state/acs, GET /v2/state/acs/active-contracts, ' +
          'POST /v2/commands/submit, POST /v2/commands/submit-and-wait. ' +
          'For full Ledger API access, use Console or Nightly wallet.',
      );
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'popup',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /** Check if the request targets the ACS query endpoint */
  private isAcsRoute(method: string, resource: string): boolean {
    const m = method.toUpperCase();
    const normalized = resource.replace(/\/+$/, '');
    // POST /v2/state/acs — filtered query (Canton Ledger API standard)
    // POST /v2/state/active-contracts — alias
    // GET  /v2/state/acs/active-contracts — unfiltered fetch of all contracts
    if (m === 'POST') {
      return normalized === '/v2/state/acs'
        || normalized === '/v2/state/active-contracts';
    }
    if (m === 'GET') {
      return normalized === '/v2/state/acs/active-contracts';
    }
    return false;
  }

  /** Check if the request targets a command submission endpoint */
  private isSubmitRoute(method: string, resource: string): boolean {
    if (method.toUpperCase() !== 'POST') return false;
    const normalized = resource.replace(/\/+$/, '');
    return normalized === '/v2/commands/submit'
      || normalized === '/v2/commands/submit-and-wait'
      || normalized === '/v2/commands/submit-and-wait-for-transaction';
  }

  /**
   * Handle POST /v2/state/acs via Loop SDK's getActiveContracts().
   *
   * The Canton Ledger API ACS request body contains a filter with template IDs.
   * We extract the first templateId from the filter and pass it to the Loop SDK.
   * The response is wrapped to match the Canton Ledger API shape.
   *
   * Important: Loop SDK expects fully-qualified Daml template IDs that include
   * the package name prefix (e.g., '#splice-amulet:Splice.Amulet:Amulet'),
   * not the short Canton Ledger API format ('Splice.Amulet:Amulet').
   */
  private async handleAcsQuery(body?: string): Promise<LedgerApiResult> {
    const provider = this.currentProvider!;

    // Parse the request body to extract template filter
    let templateId: string | undefined;
    let interfaceId: string | undefined;

    if (body) {
      try {
        const parsed = JSON.parse(body) as {
          filter?: {
            filtersByParty?: Record<string, {
              inclusive?: {
                templateFilters?: Array<{ templateId?: string; interfaceId?: string }>;
              };
            }>;
          };
          templateId?: string;
          interfaceId?: string;
        };

        // Extract from Canton Ledger API filter format
        if (parsed.filter?.filtersByParty) {
          const partyFilters = Object.values(parsed.filter.filtersByParty);
          for (const pf of partyFilters) {
            const templates = pf.inclusive?.templateFilters;
            if (templates && templates.length > 0) {
              templateId = templates[0].templateId;
              interfaceId = templates[0].interfaceId;
              break;
            }
          }
        }

        // Also accept direct templateId/interfaceId (simplified format)
        if (!templateId && parsed.templateId) {
          templateId = parsed.templateId;
        }
        if (!interfaceId && parsed.interfaceId) {
          interfaceId = parsed.interfaceId;
        }
      } catch {
        // If body is not valid JSON, call without filters
      }
    }

    // Call Loop SDK's getActiveContracts() with descriptive error context
    let result: unknown;
    try {
      result = await provider.getActiveContracts({
        templateId,
        interfaceId,
      });
    } catch (err) {
      const filterDesc = templateId
        ? `templateId="${templateId}"`
        : interfaceId
          ? `interfaceId="${interfaceId}"`
          : 'no filter (unfiltered query)';
      const hint = !templateId && !interfaceId
        ? ' Loop wallet may not support unfiltered ACS queries — try providing a templateId or interfaceId.'
        : templateId && !templateId.startsWith('#')
          ? ` Loop wallet expects fully-qualified Daml template IDs with a package name prefix`
            + ` (e.g., '#splice-amulet:Splice.Amulet:Amulet'), not the short Canton format`
            + ` ('Splice.Amulet:Amulet').`
          : '';
      throw new Error(
        `Loop getActiveContracts() failed for ${filterDesc}.${hint}`
        + ` Original error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Normalize the Loop SDK response — it may be a plain array or an
    // object with a known contracts key.
    const contracts = extractContracts(result);
    const acsResponse = {
      activeContracts: contracts,
      workflowId: '',
    };

    return { response: JSON.stringify(acsResponse) };
  }

  /**
   * Handle POST /v2/commands/submit[-and-wait] via Loop SDK's
   * submitTransaction() or submitAndWaitForTransaction().
   */
  private async handleSubmitCommand(resource: string, body?: string): Promise<LedgerApiResult> {
    const provider = this.currentProvider!;

    if (!body) {
      throw new Error('Command submission requires a request body');
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const normalized = resource.replace(/\/+$/, '');
    const waitForResult = normalized.includes('wait');

    const result = waitForResult
      ? await provider.submitAndWaitForTransaction(payload)
      : await provider.submitTransaction(payload);

    return { response: JSON.stringify(result) };
  }

  /**
   * Map network ID to Loop SDK network format.
   */
  private mapNetworkToLoop(network: string): 'local' | 'devnet' | 'mainnet' {
    if (network === 'local') return 'local';
    if (network === 'devnet' || network === 'testnet') return 'devnet';
    return 'mainnet';
  }
}

/**
 * Extract a contracts array from the Loop SDK response.
 *
 * The SDK's getActiveContracts() may return:
 *   - A plain array of contract objects (most common)
 *   - An object with a known key containing the array
 *
 * This helper normalizes all shapes to a flat array.
 */
function extractContracts(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    // Try common response wrapper keys
    for (const key of ['active_contracts', 'activeContracts', 'contracts', 'result']) {
      if (Array.isArray(obj[key])) {
        return obj[key] as unknown[];
      }
    }
  }
  return [];
}
