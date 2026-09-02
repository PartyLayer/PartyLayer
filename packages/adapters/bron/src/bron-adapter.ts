/**
 * Bron Wallet Adapter
 * 
 * Enterprise remote signer adapter using OAuth2 + API client.
 * 
 * References:
 * - Bron developer portal: https://developer.bron.org/
 * - Bron ecosystem: https://www.canton.network/ecosystem/bron-wallet
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
  LedgerApiParams,
  LedgerApiResult,
} from '@partylayer/core';
import { normalizeLedgerMethodUpper, ledgerApiBodyToString } from '@partylayer/core';
import {
  toWalletId,
  toSignature,
  toTransactionHash,
  UserRejectedError,
  mapUnknownErrorToPartyLayerError,
  type CapabilityKey,
} from '@partylayer/core';
import { BronAuthClient, type BronAuthConfig } from './auth';
import { BronApiClient } from './api';

// Re-export types for convenience
export type { BronAuthConfig } from './auth';
export type { BronApiConfig } from './api';

/**
 * API configuration for the Bron adapter. Only `baseUrl` is needed: the adapter
 * supplies its own access-token getter, wired to its OAuth client, so a caller
 * neither provides nor overrides one. This is deliberately narrower than the
 * internal BronApiConfig (which the API client uses and does carry a token getter).
 */
export interface BronAdapterApiConfig {
  /** Base URL of the Bron signer API. */
  baseUrl: string;
}

/**
 * Bron adapter configuration
 */
export interface BronAdapterConfig {
  /** OAuth2 configuration */
  auth: BronAuthConfig;
  /** API configuration */
  api: BronAdapterApiConfig;
}

/**
 * Bron Wallet Adapter
 */
export class BronAdapter implements WalletAdapter {
  readonly walletId = toWalletId('bron');
  readonly name = 'Bron';

  private authClient: BronAuthClient;
  private apiClient: BronApiClient;

  constructor(config: BronAdapterConfig) {
    // Initialize auth client
    // Tokens stored in memory by default (secure)
    // Can optionally use encrypted storage if provided
    this.authClient = new BronAuthClient(config.auth);

    // Initialize the real API client. There is no URL- or environment-inferred
    // mock: a mock, if wanted for a test, must be constructed explicitly by the
    // test, never triggered by a substring in a URL or by NODE_ENV.
    this.apiClient = new BronApiClient({
      baseUrl: config.api.baseUrl,
      getAccessToken: async () => {
        return await this.authClient.getAccessToken();
      },
    });
  }

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'remoteSigner',
      'signMessage',
      'signTransaction',
      'ledgerApi',
    ];
  }

  detectInstalled(): Promise<AdapterDetectResult> {
    // Bron is an enterprise remote signer - no "installation" required
    // Availability depends on OAuth2 configuration
    return Promise.resolve({
      installed: true,
      reason: 'Bron is a remote signer service',
    });
  }

  async connect(
    ctx: AdapterContext,
    _opts?: {
      timeoutMs?: number;
      requiredCapabilities?: CapabilityKey[];
    }
  ): Promise<AdapterConnectResult> {
    try {
      // Check if we have an access token
      const accessToken = await this.authClient.getAccessToken();

      // If no token, start OAuth flow
      if (!accessToken) {
        if (typeof window === 'undefined') {
          throw new Error('OAuth flow requires browser environment');
        }

        const authUrl = await this.authClient.startAuth();
        
        // Open auth URL (popup or redirect)
        const popup = window.open(
          authUrl,
          'Bron Auth',
          'width=500,height=600'
        );

        if (!popup) {
          throw new Error('Failed to open auth popup');
        }

        // The OAuth callback (finishAuth with the returned code) must be handled
        // by the app; the adapter has no redirect handler of its own. Fail loudly
        // rather than fabricating a token — there is no dev/mock shortcut.
        throw new Error('OAuth callback not implemented in adapter - handle in app');
      }

      // Create session with Bron API
      const session = await this.apiClient.createSession();

      return {
        partyId: session.partyId,
        session: {
          walletId: this.walletId,
          // Bron's API session does not report the connected network → not
          // wallet-reported, so network-mismatch detection is limited for this
          // adapter (echoes the requested ctx.network).
          network: ctx.network,
          createdAt: Date.now(),
          expiresAt: session.expiresAt,
          capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'remoteSigner'],
          metadata: {
            sessionId: session.sessionId,
          },
        },
        capabilities: ['connect', 'signMessage', 'signTransaction', 'remoteSigner'],
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'remote',
      });
    }
  }

  async disconnect(
    _ctx: AdapterContext,
    _session: import('@partylayer/core').Session
  ): Promise<void> {
    await this.authClient.logout();
  }

  async restore(
    _ctx: AdapterContext,
    persisted: import('@partylayer/core').PersistedSession
  ): Promise<import('@partylayer/core').Session | null> {
    // Check if we have a session ID and access token
    const sessionId = persisted.metadata?.sessionId;
    if (typeof sessionId !== 'string') {
      return null;
    }

    const accessToken = await this.authClient.getAccessToken();
    if (!accessToken) {
      return null; // No token to restore
    }

    // Check expiration
    if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
      return null;
    }

    // Restore session
    return {
      ...persisted,
      walletId: this.walletId,
    };
  }

  async signMessage(
    _ctx: AdapterContext,
    session: import('@partylayer/core').Session,
    params: SignMessageParams
  ): Promise<import('@partylayer/core').SignedMessage> {
    try {
      const sessionId = session.metadata?.sessionId;
      if (typeof sessionId !== 'string') {
        throw new Error('No session ID');
      }

      // Request signature
      const signResponse = await this.apiClient.requestSignature({
        message: params.message,
        sessionId,
      });

      // If pending, poll for status
      if (signResponse.status === 'pending') {
        const status = await this.apiClient.pollRequestStatus(signResponse.requestId);
        
        if (status.status === 'denied') {
          throw new UserRejectedError('Signature request denied');
        }

        if (status.status === 'approved' && status.signature) {
          return {
            message: params.message,
            signature: toSignature(status.signature),
            partyId: session.partyId,
          };
        }

        throw new Error('Signature request failed');
      }

      if (signResponse.status === 'denied') {
        throw new UserRejectedError('Signature request denied');
      }

      if (!signResponse.signature) {
        throw new Error('No signature in response');
      }

      return {
        message: params.message,
        signature: toSignature(signResponse.signature),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'remote',
      });
    }
  }

  async signTransaction(
    _ctx: AdapterContext,
    session: import('@partylayer/core').Session,
    params: SignTransactionParams
  ): Promise<import('@partylayer/core').SignedTransaction> {
    try {
      const sessionId = session.metadata?.sessionId;
      if (typeof sessionId !== 'string') {
        throw new Error('No session ID');
      }

      // Request signature
      const signResponse = await this.apiClient.requestSignature({
        transaction: params.tx,
        sessionId,
      });

      // If pending, poll for status
      if (signResponse.status === 'pending') {
        const status = await this.apiClient.pollRequestStatus(signResponse.requestId);
        
        if (status.status === 'denied') {
          throw new UserRejectedError('Transaction signing denied');
        }

        if (status.status === 'approved' && status.signature) {
          const signedTx = typeof params.tx === 'object' && params.tx !== null
            ? { ...params.tx as Record<string, unknown>, signature: status.signature }
            : { tx: params.tx, signature: status.signature };
          return {
            signedTx,
            // Was `toTransactionHash('pending')` when Bron reported no hash.
            // The field is optional now, so nothing is what gets reported.
            ...(status.transactionHash
              ? { transactionHash: toTransactionHash(status.transactionHash) }
              : {}),
            partyId: session.partyId,
          };
        }

        throw new Error('Transaction signing failed');
      }

      if (signResponse.status === 'denied') {
        throw new UserRejectedError('Transaction signing denied');
      }

      if (!signResponse.signature) {
        throw new Error('No signature in response');
      }

      const signedTx = typeof params.tx === 'object' && params.tx !== null
        ? { ...params.tx as Record<string, unknown>, signature: signResponse.signature }
        : { tx: params.tx, signature: signResponse.signature };
      return {
        signedTx,
        ...(signResponse.transactionHash
          ? { transactionHash: toTransactionHash(signResponse.transactionHash) }
          : {}),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signTransaction',
        transport: 'remote',
      });
    }
  }

  /**
   * Proxy a Canton Ledger API request through the Bron enterprise API.
   *
   * Bron acts as an authenticated HTTP proxy — it forwards the request
   * to the Canton Ledger API using the enterprise session credentials.
   */
  async ledgerApi(
    ctx: AdapterContext,
    session: import('@partylayer/core').Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    try {
      const sessionId = session.metadata?.sessionId;
      if (typeof sessionId !== 'string') {
        throw new Error('No session ID');
      }

      ctx.logger.debug('Proxying ledger API request via Bron', {
        sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
      });

      const result = await this.apiClient.proxyLedgerApi({
        requestMethod: normalizeLedgerMethodUpper(params.requestMethod),
        resource: params.resource,
        body: ledgerApiBodyToString(params.body),
        sessionId,
      });

      return { response: result.response };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'remote',
      });
    }
  }
}
