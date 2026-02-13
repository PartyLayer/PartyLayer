/**
 * Nightly Wallet adapter implementation
 *
 * Nightly is a multichain wallet with Canton Network support.
 * The wallet injects at window.nightly.canton and uses a custom
 * (non-CIP-0103) interface with callback-based signing.
 *
 * Reference: https://docs.nightly.app/docs/canton/canton/connect/
 * Template:  https://github.com/nightly-labs/canton-web3-template
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

// ─── Nightly Canton Types ───────────────────────────────────────────────────

/** Sign request response types from Nightly wallet */
enum SignRequestResponseType {
  SIGN_REQUEST_APPROVED = 'sign_request_approved',
  SIGN_REQUEST_REJECTED = 'sign_request_rejected',
  SIGN_REQUEST_ERROR = 'sign_request_error',
}

interface SignRequestResponse {
  type: SignRequestResponseType;
  data:
    | { signature?: string; updateId?: string }
    | { reason: string }
    | { error: string };
}

interface Instrument {
  id: string;
  admin: string;
}

interface TransactionCommand {
  command: unknown;
  disclosedContracts: unknown[];
}

interface CreateTransferCommandParams {
  receiverPartyId: string;
  amount: string;
  instrument: Instrument;
  memo?: string;
  expiryDate?: string;
}

/** The wallet object returned after successful connection */
interface NightlyCantonWallet {
  partyId: string;
  publicKey: string;
  signMessage: (
    message: string,
    onResponse: (response: SignRequestResponse) => void,
  ) => void;
  createTransferCommand: (
    params: CreateTransferCommandParams,
  ) => Promise<TransactionCommand>;
  submitTransactionCommand: (
    transactionCommand: TransactionCommand,
    onResponse: (response: SignRequestResponse) => void,
  ) => void;
  getPendingTransactions: () => Promise<unknown[] | null>;
  getHoldingUtxos: () => Promise<unknown[] | null>;
}

/** The injected provider at window.nightly.canton */
interface NightlyCantonProvider extends NightlyCantonWallet {
  connect: () => Promise<{ partyId: string; publicKey: string }>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
}

declare global {
  interface Window {
    nightly?: {
      canton?: NightlyCantonProvider;
    };
  }
}

// ─── Adapter ────────────────────────────────────────────────────────────────

/**
 * Nightly Wallet adapter
 *
 * Implements WalletAdapter interface for Nightly Wallet's Canton support.
 * The wallet injects at window.nightly.canton and provides:
 * - connect/disconnect via Promise
 * - signMessage via callback
 * - transaction commands via callback
 * - session restore via isConnected()
 */
export class NightlyAdapter implements WalletAdapter {
  readonly walletId = toWalletId('nightly');
  readonly name = 'Nightly';

  private wallet: NightlyCantonWallet | null = null;

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'submitTransaction',
      'events',
      'injected',
    ];
  }

  /**
   * Detect if Nightly wallet extension is installed.
   * Checks for window.nightly.canton provider.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }

    if (window.nightly?.canton) {
      return {
        installed: true,
        reason: 'Nightly wallet detected',
      };
    }

    return {
      installed: false,
      reason:
        'Nightly wallet not detected. Install from https://nightly.app/download',
    };
  }

  /**
   * Connect to Nightly Wallet.
   *
   * Calls window.nightly.canton.connect() which opens the extension
   * popup for user approval.
   */
  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId },
  ): Promise<AdapterConnectResult> {
    try {
      const provider = window.nightly?.canton;
      if (!provider) {
        throw new WalletNotInstalledError(
          this.walletId,
          'Nightly wallet not detected. Install from https://nightly.app/download',
        );
      }

      ctx.logger.debug('Connecting to Nightly Wallet', {
        appName: ctx.appName,
        network: ctx.network,
      });

      // connect() opens the extension popup for approval
      await provider.connect();

      // After connect, the provider itself acts as the wallet
      this.wallet = provider;
      const partyId = toPartyId(provider.partyId);

      ctx.logger.info('Connected to Nightly Wallet', {
        partyId: provider.partyId,
      });

      return {
        partyId,
        session: {
          walletId: this.walletId,
          network: ctx.network,
          createdAt: Date.now(),
          metadata: {
            publicKey: provider.publicKey,
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
   * Disconnect from Nightly Wallet.
   */
  async disconnect(ctx: AdapterContext, _session: Session): Promise<void> {
    try {
      await window.nightly?.canton?.disconnect();
    } catch (err) {
      ctx.logger.warn('Error during Nightly wallet disconnect', err);
    }
    this.wallet = null;
  }

  /**
   * Restore session — check if Nightly is still connected.
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

      const provider = window.nightly?.canton;
      if (!provider) return null;

      // Check if the wallet reports being connected
      if (typeof provider.isConnected === 'function' && provider.isConnected()) {
        this.wallet = provider;
        ctx.logger.debug('Restored Nightly Wallet session', {
          partyId: provider.partyId,
        });
        return { ...persisted, walletId: this.walletId };
      }

      return null;
    } catch (err) {
      ctx.logger.warn('Failed to restore Nightly wallet session', err);
      return null;
    }
  }

  /**
   * Sign a message.
   *
   * Nightly uses a callback-based signMessage API — we wrap it
   * in a Promise for the WalletAdapter interface.
   */
  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    try {
      if (!this.wallet) {
        throw new Error('Not connected to Nightly Wallet');
      }

      ctx.logger.debug('Signing message with Nightly Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
      });

      const signature = await new Promise<string>((resolve, reject) => {
        this.wallet!.signMessage(params.message, (response) => {
          if (response.type === SignRequestResponseType.SIGN_REQUEST_APPROVED) {
            const data = response.data as { signature?: string };
            resolve(data.signature || '');
          } else if (
            response.type === SignRequestResponseType.SIGN_REQUEST_REJECTED
          ) {
            const data = response.data as { reason: string };
            reject(new Error(`Sign rejected: ${data.reason}`));
          } else {
            const data = response.data as { error: string };
            reject(new Error(`Sign error: ${data.error}`));
          }
        });
      });

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
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Sign a transaction — not supported standalone.
   *
   * Nightly combines signing and submission via submitTransactionCommand.
   */
  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(
      this.walletId,
      'signTransaction — Nightly combines signing and submission. Use submitTransaction instead.',
    );
  }

  /**
   * Submit a transaction.
   *
   * Nightly uses callback-based submitTransactionCommand.
   * The signedTx should be a TransactionCommand object created via
   * createTransferCommand or createTransactionChoiceCommand.
   */
  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      if (!this.wallet) {
        throw new Error('Not connected to Nightly Wallet');
      }

      ctx.logger.debug('Submitting transaction with Nightly Wallet', {
        sessionId: session.sessionId,
      });

      const txCommand = params.signedTx as TransactionCommand;

      const result = await new Promise<{ signature?: string; updateId?: string }>(
        (resolve, reject) => {
          this.wallet!.submitTransactionCommand(txCommand, (response) => {
            if (
              response.type === SignRequestResponseType.SIGN_REQUEST_APPROVED
            ) {
              resolve(
                response.data as { signature?: string; updateId?: string },
              );
            } else if (
              response.type === SignRequestResponseType.SIGN_REQUEST_REJECTED
            ) {
              const data = response.data as { reason: string };
              reject(new Error(`Transaction rejected: ${data.reason}`));
            } else {
              const data = response.data as { error: string };
              reject(new Error(`Transaction error: ${data.error}`));
            }
          });
        },
      );

      const hash =
        result.updateId ||
        result.signature ||
        `tx_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      return {
        transactionHash: toTransactionHash(hash),
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
}
