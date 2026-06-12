/**
 * Walley Wallet adapter implementation.
 *
 * Walley (https://walley.cc) is a self-custodial Canton wallet. Keys are an
 * Ed25519 pair derived in-browser from a WebAuthn passkey (PRF extension) — no
 * private key ever leaves the user's device. dApps reach it through a popup
 * JSON-RPC bridge: connect / sign / execute each open a short-lived popup on
 * the Walley host where the user approves with their passkey.
 *
 * This adapter mirrors the wire protocol of `@k2flabs/walley-dapp-sdk` while
 * exposing it through PartyLayer's `WalletAdapter` contract. It is transport
 * type `popup` and, like other approve-in-wallet wallets, fuses signing and
 * submission (`submitTransaction`) rather than offering a detached
 * `signTransaction`.
 */

import type {
  AdapterConnectResult,
  AdapterContext,
  AdapterDetectResult,
  CapabilityKey,
  LedgerApiParams,
  LedgerApiResult,
  NetworkId,
  PartyId,
  PersistedSession,
  Session,
  SignedMessage,
  SignedTransaction,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  TxReceipt,
  WalletAdapter,
} from '@partylayer/core';
import {
  CapabilityNotSupportedError,
  mapUnknownErrorToPartyLayerError,
  toPartyId,
  toSignature,
  toTransactionHash,
  toWalletId,
} from '@partylayer/core';

import {
  WALLEY_POPUP_PATHS,
  WALLEY_SIGNING_METHOD,
  WALLEY_WALLET_ID,
  resolveWalleyHost,
} from './constants';
import { WalleyNotAvailableError } from './errors';
import { WalleyPopupTransport } from './popup-transport';
import type {
  WalleyConnectParams,
  WalleyConnectResult,
  WalleyPrepareExecuteParams,
  WalleyPrepareExecuteResult,
  WalleySignMessageResult,
} from './types';

export interface WalleyAdapterConfig {
  /**
   * Override the Walley host. By default the adapter targets the hosted Walley
   * wallet for the active network; set this only to point at a self-hosted one.
   */
  host?: string;
}

export class WalleyAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLEY_WALLET_ID);
  readonly name = 'Walley';

  private readonly hostOverride?: string;

  constructor(config?: WalleyAdapterConfig) {
    this.hostOverride = config?.host;
  }

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'submitTransaction',
      'ledgerApi',
      'popup',
    ];
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    // Hosted wallet — available wherever a browser can open a popup; false in SSR/Node.
    if (typeof window === 'undefined' || typeof window.open !== 'function') {
      return { installed: false, reason: 'Browser environment with popups required' };
    }
    return { installed: true, reason: 'Walley available via passkey popup at walley.cc' };
  }

  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
      preferInstalled?: boolean;
      onDisplayUri?: (uri: string) => void;
    },
  ): Promise<AdapterConnectResult> {
    try {
      if (typeof window === 'undefined' || typeof window.open !== 'function') {
        throw new WalleyNotAvailableError();
      }

      const host = resolveWalleyHost(ctx.network, this.hostOverride);
      const transport = new WalleyPopupTransport(host);

      const params: WalleyConnectParams = {};
      const result = await transport.send<WalleyConnectResult>(
        WALLEY_POPUP_PATHS.connect,
        'connect',
        params,
        { timeoutMs: opts?.timeoutMs, signal: ctx.abortSignal },
      );

      const partyId = toPartyId(result.partyId);
      const metadata: Record<string, string> = {
        host,
        partyHint: result.partyHint,
        publicKeyFingerprint: result.publicKeyFingerprint,
        publicKeyBase64: result.publicKeyBase64,
        walletNetworkId: result.networkId,
        signingMethod: WALLEY_SIGNING_METHOD,
      };
      if (result.accessToken) metadata.accessToken = result.accessToken;
      if (result.apiBaseUrl) metadata.apiBaseUrl = result.apiBaseUrl;
      if (typeof result.expiresAt === 'number') {
        metadata.accessTokenExpiresAt = String(result.expiresAt);
      }

      return {
        partyId,
        session: {
          walletId: this.walletId,
          network: ctx.network,
          createdAt: Date.now(),
          ...(typeof result.expiresAt === 'number'
            ? { expiresAt: result.expiresAt * 1000 }
            : {}),
          metadata,
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'popup',
        details: { origin: ctx.origin, network: ctx.network },
      });
    }
  }

  async disconnect(ctx: AdapterContext, _session: Session): Promise<void> {
    // No server-side dApp session to tear down; PartyLayer drops the persisted one.
    ctx.logger.debug('Walley disconnect — clearing local session');
  }

  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    // The persisted session already carries the party + access token. An expired
    // token surfaces as a 401 on the next ledgerApi call, prompting a re-connect.
    if (persisted.walletId !== this.walletId) return null;
    if (typeof persisted.expiresAt === 'number' && persisted.expiresAt <= Date.now()) {
      ctx.logger.debug('Walley session access token expired — reconnect required for ledgerApi');
    }
    return persisted;
  }

  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    try {
      const transport = this.transportFor(session.network);
      const result = await transport.send<WalleySignMessageResult>(
        WALLEY_POPUP_PATHS.sign,
        'signMessage',
        { message: params.message },
        { signal: ctx.abortSignal },
      );
      return {
        signature: toSignature(result.signature),
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
        details: { origin: ctx.origin, network: session.network },
      });
    }
  }

  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(
      this.walletId,
      'signTransaction — Walley fuses signing and submission. Use submitTransaction (prepareExecuteAndWait).',
    );
  }

  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      const payload = params.signedTx as WalleyPrepareExecuteParams;
      const transport = this.transportFor(session.network);
      const result = await transport.send<WalleyPrepareExecuteResult | null>(
        WALLEY_POPUP_PATHS.execute,
        'prepareExecuteAndWait',
        payload,
        { signal: ctx.abortSignal },
      );

      const updateId = result?.updateId;
      const commandId = result?.commandId ?? payload?.commandId;
      const hash = updateId ?? commandId;
      if (!hash) {
        // Approved but no handle returned; pass a `commandId` to get a receipt id.
        throw new Error(
          'Walley did not return a transaction handle. Provide a commandId in the execute params to receive a receipt id.',
        );
      }

      return {
        transactionHash: toTransactionHash(hash),
        submittedAt: Date.now(),
        ...(commandId ? { commandId } : {}),
        ...(updateId ? { updateId } : {}),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'popup',
        details: { origin: ctx.origin, network: session.network },
      });
    }
  }

  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    const accessToken = session.metadata?.accessToken;
    const host = session.metadata?.host ?? resolveWalleyHost(session.network, this.hostOverride);
    const apiBase = (session.metadata?.apiBaseUrl ?? host).replace(/\/+$/, '');

    if (!accessToken) {
      throw mapUnknownErrorToPartyLayerError(
        new Error('Walley session has no access token — reconnect to obtain one.'),
        {
          walletId: this.walletId,
          phase: 'ledgerApi',
          transport: 'popup',
          details: { origin: ctx.origin, network: session.network },
        },
      );
    }

    const resource = params.resource.startsWith('/') ? params.resource : `/${params.resource}`;
    const url = `${apiBase}/v1/proxy${resource}`;

    try {
      const res = await fetch(url, {
        method: params.requestMethod.toUpperCase(),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(params.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(params.body ? { body: params.body } : {}),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `Walley ledger proxy ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
        );
      }
      return { response: text };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'popup',
        details: { origin: ctx.origin, network: session.network },
      });
    }
  }

  private transportFor(network: NetworkId): WalleyPopupTransport {
    return new WalleyPopupTransport(resolveWalleyHost(network, this.hostOverride));
  }
}
