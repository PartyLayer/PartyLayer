/**
 * Cantor8 (C8) Wallet Adapter
 * 
 * Implements WalletAdapter interface for Cantor8 wallet using deep link transport.
 * 
 * References:
 * - Cantor8 ecosystem: https://www.canton.network/ecosystem/cantor8
 * - Cantor8 site: https://cantor8.tech/about
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  SignMessageParams,
  SignTransactionParams,
} from '@cantonconnect/core';
import {
  toWalletId,
  toSignature,
  toTransactionHash,
  UserRejectedError,
  mapUnknownErrorToCantonConnectError,
  type CapabilityKey,
} from '@cantonconnect/core';
import { DeepLinkTransport, MockTransport } from '@cantonconnect/core';
import type {
  Cantor8VendorModule,
  Cantor8VendorConfig,
} from './vendor';
import {
  StubCantor8VendorModule,
} from './vendor';

/**
 * Cantor8 adapter configuration
 */
export interface Cantor8AdapterConfig {
  /** Vendor module (defaults to stub) */
  vendorModule?: Cantor8VendorModule;
  /** Vendor configuration */
  vendorConfig?: Cantor8VendorConfig;
  /** Use mock transport in development */
  useMockTransport?: boolean;
}

/**
 * Cantor8 Wallet Adapter
 */
export class Cantor8Adapter implements WalletAdapter {
  readonly walletId = toWalletId('cantor8');
  readonly name = 'Cantor8';

  private vendorModule: Cantor8VendorModule;
  private vendorConfig: Cantor8VendorConfig;
  private transport: DeepLinkTransport | MockTransport;

  constructor(config: Cantor8AdapterConfig = {}) {
    this.vendorModule = config.vendorModule || new StubCantor8VendorModule();
    this.vendorConfig = config.vendorConfig || {};
    
    // Use mock transport in development if configured
    if (config.useMockTransport || process.env.NODE_ENV === 'development') {
      this.transport = new MockTransport();
    } else {
      this.transport = new DeepLinkTransport();
    }
  }

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'deeplink',
      'signMessage',
      'signTransaction',
      // restore depends on sessionToken support
    ];
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    // Cantor8 is a mobile wallet - detection is not straightforward
    // We can check for deep link support or user agent hints
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }

    // Check if device supports deep links (mobile)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // For now, assume installed if mobile device
    // In production, might check for specific user agent or other hints
    return {
      installed: isMobile,
      reason: isMobile ? undefined : 'Cantor8 is a mobile wallet',
    };
  }

  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: import('@cantonconnect/core').PartyId;
    }
  ): Promise<AdapterConnectResult> {
    try {
      // Create connect request
      const state = this.generateState();
      const redirectUri = this.vendorConfig.redirectUri || `${ctx.origin}/callback`;
      const request: import('@cantonconnect/core').ConnectRequest = {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
        requestedCapabilities: undefined, // Cantor8 doesn't support capability filtering yet
        state,
        redirectUri,
      };

      // Create connect URL using vendor module
      const connectUrl = this.vendorModule.createConnectUrl(request, this.vendorConfig);

      // Open via transport
      const transportOptions: import('@cantonconnect/core').TransportOptions = {
        timeoutMs: opts?.timeoutMs || 60000,
        allowedOrigins: [ctx.origin],
        origin: ctx.origin,
      };

      const response = await this.transport.openConnectRequest(
        connectUrl,
        request,
        transportOptions
      );

      // Check for error
      if (response.error) {
        if (response.error.code === 'USER_REJECTED' || response.error.code === 'CANCELLED') {
          throw new UserRejectedError('User rejected connection');
        }
        throw new Error(response.error.message || 'Connection failed');
      }

      if (!response.partyId) {
        throw new Error('No partyId in response');
      }

      // Return result
      return {
        partyId: response.partyId,
        session: {
          walletId: this.walletId,
          network: ctx.network,
          createdAt: Date.now(),
          expiresAt: response.expiresAt,
          capabilitiesSnapshot: (response.capabilities || ['connect', 'signMessage']) as CapabilityKey[],
          metadata: {
            sessionToken: response.sessionToken || '',
          },
        },
        capabilities: (response.capabilities || ['connect', 'signMessage']) as CapabilityKey[],
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'deeplink',
      });
    }
  }

  async disconnect(
    _ctx: AdapterContext,
    _session: import('@cantonconnect/core').Session
  ): Promise<void> {
    // Cantor8 doesn't have explicit disconnect - session expires naturally
    // Clear any stored session tokens
    if (_session.metadata?.sessionToken) {
      // In production, might call a logout endpoint
    }
  }

  async restore(
    _ctx: AdapterContext,
    persisted: import('@cantonconnect/core').PersistedSession
  ): Promise<import('@cantonconnect/core').Session | null> {
    // Check if we have a session token
    const sessionToken = persisted.metadata?.sessionToken as string | undefined;
    if (!sessionToken) {
      return null; // No token to restore
    }

    // In production, might validate token with vendor API
    // For now, if token exists and session not expired, restore
    if (persisted.expiresAt && Date.now() >= persisted.expiresAt) {
      return null; // Expired
    }

    // Return restored session
    return {
      ...persisted,
      walletId: this.walletId,
    };
  }

  async signMessage(
    ctx: AdapterContext,
    session: import('@cantonconnect/core').Session,
    params: SignMessageParams
  ): Promise<import('@cantonconnect/core').SignedMessage> {
    try {
      const state = this.generateState();
      const redirectUri = this.vendorConfig.redirectUri || `${ctx.origin}/callback`;
      const request: import('@cantonconnect/core').SignRequest = {
        message: params.message,
        state,
        redirectUri,
      };

      const signUrl = this.vendorModule.createSignUrl(request, this.vendorConfig);

      const transportOptions: import('@cantonconnect/core').TransportOptions = {
        timeoutMs: 60000,
        allowedOrigins: [ctx.origin],
        origin: ctx.origin,
      };

      const response = await this.transport.openSignRequest(
        signUrl,
        request,
        transportOptions
      );

      if (response.error) {
        if (response.error.code === 'USER_REJECTED') {
          throw new UserRejectedError('User rejected signing');
        }
        throw new Error(response.error.message || 'Signing failed');
      }

      if (!response.signature) {
        throw new Error('No signature in response');
      }

      return {
        message: params.message,
        signature: toSignature(response.signature),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'deeplink',
      });
    }
  }

  async signTransaction(
    ctx: AdapterContext,
    session: import('@cantonconnect/core').Session,
    params: SignTransactionParams
  ): Promise<import('@cantonconnect/core').SignedTransaction> {
    try {
      const state = this.generateState();
      const redirectUri = this.vendorConfig.redirectUri || `${ctx.origin}/callback`;
      const request: import('@cantonconnect/core').SignRequest = {
        transaction: params.tx,
        state,
        redirectUri,
      };

      const signUrl = this.vendorModule.createSignUrl(request, this.vendorConfig);

      const transportOptions: import('@cantonconnect/core').TransportOptions = {
        timeoutMs: 60000,
        allowedOrigins: [ctx.origin],
        origin: ctx.origin,
      };

      const response = await this.transport.openSignRequest(
        signUrl,
        request,
        transportOptions
      );

      if (response.error) {
        if (response.error.code === 'USER_REJECTED') {
          throw new UserRejectedError('User rejected signing');
        }
        throw new Error(response.error.message || 'Signing failed');
      }

      // Handle async approval (jobId)
      if (response.jobId && this.vendorModule.pollJobStatus) {
        const statusUrl = this.vendorConfig.statusEndpoint || '';
        const jobStatus = await this.vendorModule.pollJobStatus(
          response.jobId,
          statusUrl,
          60000
        );

        if (jobStatus.status === 'denied') {
          throw new UserRejectedError('Transaction signing denied');
        }

        if (jobStatus.status === 'approved' && jobStatus.result?.signature) {
          const signedTx = typeof params.tx === 'object' && params.tx !== null
            ? { ...params.tx as Record<string, unknown>, signature: jobStatus.result.signature }
            : { tx: params.tx, signature: jobStatus.result.signature };
          return {
            signedTx,
            transactionHash: jobStatus.result.transactionHash
              ? toTransactionHash(jobStatus.result.transactionHash)
              : toTransactionHash('pending'),
            partyId: session.partyId,
          };
        }

        throw new Error('Job not completed');
      }

      if (!response.signature) {
        throw new Error('No signature in response');
      }

      const signedTx = typeof params.tx === 'object' && params.tx !== null
        ? { ...params.tx as Record<string, unknown>, signature: response.signature }
        : { tx: params.tx, signature: response.signature };
      return {
        signedTx,
        transactionHash: response.transactionHash
          ? toTransactionHash(response.transactionHash)
          : toTransactionHash('pending'),
        partyId: session.partyId,
      };
    } catch (err) {
      throw mapUnknownErrorToCantonConnectError(err, {
        walletId: this.walletId,
        phase: 'signTransaction',
        transport: 'deeplink',
      });
    }
  }

  /**
   * Generate random state nonce
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
