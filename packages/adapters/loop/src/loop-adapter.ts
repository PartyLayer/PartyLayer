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
   * Proxy a Ledger API request through the Loop Wallet.
   *
   * Loop SDK may expose ledgerApi on the LoopProvider or via a generic
   * request() method. We check at runtime to handle SDK versions gracefully.
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

      ctx.logger.debug('Proxying ledger API request via Loop Wallet', {
        sessionId: session.sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
      });

      const provider = this.currentProvider as unknown as {
        ledgerApi?: (method: string, resource: string, body?: string) => Promise<unknown>;
        request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
      };

      if (typeof provider.ledgerApi === 'function') {
        const result = await provider.ledgerApi(
          params.requestMethod,
          params.resource,
          params.body,
        );
        const response = result as { response?: string } | string;
        return {
          response: typeof response === 'string'
            ? response
            : (response?.response ?? JSON.stringify(response)),
        };
      }

      if (typeof provider.request === 'function') {
        const result = await provider.request({
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
        'ledgerApi — update Loop SDK to a version that supports CIP-0103 ledgerApi',
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

  /**
   * Map network ID to Loop SDK network format.
   */
  private mapNetworkToLoop(network: string): 'local' | 'devnet' | 'mainnet' {
    if (network === 'local') return 'local';
    if (network === 'devnet' || network === 'testnet') return 'devnet';
    return 'mainnet';
  }
}
