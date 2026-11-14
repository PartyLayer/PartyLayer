/**
 * CIP-0103 Method Router
 *
 * Routes request({ method, params }) calls to the correct handler function.
 * By default, all 10 mandatory CIP-0103 methods are registered as passthrough
 * handlers that delegate to the native wallet Provider.
 *
 * Forward-compatible: unknown methods are passed through to the wallet provider
 * rather than rejected, allowing support for future CIP extensions.
 */

import type {
  CIP0103Provider,
  CIP0103RequestPayload,
  CIP0103RequestParams,
} from '@partylayer/core';
import { unsupportedMethod, disconnected } from './errors';
import { toProviderRpcError } from './error-map';
import { validateRequestPayload } from './request-validation';

export type MethodHandler<T = unknown> = (
  walletProvider: CIP0103Provider,
  params?: CIP0103RequestParams,
) => Promise<T>;

export class MethodRouter {
  private handlers = new Map<string, MethodHandler>();
  private walletProvider: CIP0103Provider | null = null;

  constructor() {
    this.registerDefaults();
  }

  /** Set / swap the underlying native wallet provider */
  setWalletProvider(provider: CIP0103Provider | null): void {
    this.walletProvider = provider;
  }

  /** Get the current wallet provider */
  getWalletProvider(): CIP0103Provider | null {
    return this.walletProvider;
  }

  /** Register (or override) a handler for a method name */
  register<T>(method: string, handler: MethodHandler<T>): void {
    this.handlers.set(method, handler as MethodHandler);
  }

  /** Route a request to the appropriate handler */
  async route<T>(payload: CIP0103RequestPayload): Promise<T> {
    validateRequestPayload(payload);
    const { method, params } = payload;

    const handler = this.handlers.get(method);

    if (!handler) {
      // Forward-compatible: pass unknown methods through to the wallet provider
      if (this.walletProvider) {
        try {
          return await this.walletProvider.request<T>(payload);
        } catch (err) {
          throw toProviderRpcError(err);
        }
      }
      throw unsupportedMethod(method);
    }

    // connect and isConnected can operate without a wallet provider
    if (!this.walletProvider && method !== 'connect' && method !== 'isConnected') {
      throw disconnected('No wallet provider connected');
    }

    try {
      return (await handler(this.walletProvider!, params)) as T;
    } catch (err) {
      throw toProviderRpcError(err);
    }
  }

  /** Check whether a handler is registered for a given method */
  hasHandler(method: string): boolean {
    return this.handlers.has(method);
  }

  // ─── Default passthrough handlers ───────────────────────────────────────

  private registerDefaults(): void {
    const passthrough = (method: string): MethodHandler => {
      return async (wp, params) => {
        return wp.request({ method, params });
      };
    };

    this.register('connect', passthrough('connect'));
    this.register('disconnect', passthrough('disconnect'));
    this.register('isConnected', passthrough('isConnected'));
    this.register('status', passthrough('status'));
    this.register('getActiveNetwork', passthrough('getActiveNetwork'));
    this.register('listAccounts', passthrough('listAccounts'));
    this.register('getPrimaryAccount', passthrough('getPrimaryAccount'));
    this.register('signMessage', passthrough('signMessage'));
    this.register('prepareExecute', passthrough('prepareExecute'));
    this.register('ledgerApi', passthrough('ledgerApi'));
  }
}
