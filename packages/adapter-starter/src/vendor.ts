/**
 * Vendor Module Pattern Example
 * 
 * This demonstrates the vendor module pattern used by adapters like Cantor8.
 * Use this pattern if your wallet has vendor-specific endpoints that may change
 * or if you want to allow swapping implementations without breaking the adapter API.
 * 
 * This is OPTIONAL - only use if your adapter needs vendor abstraction.
 */

import type {
  ConnectRequest,
  ConnectResponse,
  SignRequest,
  SignResponse,
} from '@cantonconnect/core';

/**
 * Vendor configuration
 */
export interface MyWalletVendorConfig {
  /** Base URL for wallet API */
  apiUrl?: string;
  /** Deep link scheme (if mobile wallet) */
  deepLinkScheme?: string;
  /** Universal link base URL */
  universalLinkBase?: string;
}

/**
 * Vendor module interface
 * 
 * Implementations can be swapped without changing adapter code.
 */
export interface MyWalletVendorModule {
  /**
   * Create connect URL
   */
  createConnectUrl(request: ConnectRequest, config: MyWalletVendorConfig): string;

  /**
   * Parse connect callback
   */
  parseConnectCallback(
    callbackData: unknown,
    expectedState: string
  ): ConnectResponse;

  /**
   * Create sign URL
   */
  createSignUrl(request: SignRequest, config: MyWalletVendorConfig): string;

  /**
   * Parse sign callback
   */
  parseSignCallback(
    callbackData: unknown,
    expectedState: string
  ): SignResponse;
}

/**
 * Default vendor module implementation
 */
export class DefaultMyWalletVendorModule implements MyWalletVendorModule {
  createConnectUrl(request: ConnectRequest, config: MyWalletVendorConfig): string {
    // TODO: Implement URL creation logic
    if (config.apiUrl) {
      const url = new URL('/connect', config.apiUrl);
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      return url.toString();
    }

    if (config.deepLinkScheme) {
      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      return `${config.deepLinkScheme}://connect?${params.toString()}`;
    }

    throw new Error('Vendor not configured - set apiUrl or deepLinkScheme');
  }

  parseConnectCallback(
    callbackData: unknown,
    expectedState: string
  ): ConnectResponse {
    // TODO: Implement callback parsing logic
    const data = callbackData as Record<string, unknown>;
    
    if (data.state !== expectedState) {
      throw new Error('State mismatch in callback');
    }

    return {
      state: String(data.state),
      // TODO: Parse partyId, sessionToken, etc. from callback data
      partyId: undefined,
      error: data.error
        ? {
            code: String((data.error as Record<string, unknown>).code || 'UNKNOWN'),
            message: String((data.error as Record<string, unknown>).message || 'Unknown error'),
          }
        : undefined,
    };
  }

  createSignUrl(request: SignRequest, config: MyWalletVendorConfig): string {
    // TODO: Implement sign URL creation
    if (config.apiUrl) {
      const url = new URL('/sign', config.apiUrl);
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      return url.toString();
    }

    throw new Error('Vendor not configured');
  }

  parseSignCallback(
    callbackData: unknown,
    expectedState: string
  ): SignResponse {
    // TODO: Implement sign callback parsing
    const data = callbackData as Record<string, unknown>;
    
    if (data.state !== expectedState) {
      throw new Error('State mismatch in callback');
    }

    return {
      state: String(data.state),
      signature: data.signature ? String(data.signature) : undefined,
      error: data.error
        ? {
            code: String((data.error as Record<string, unknown>).code || 'UNKNOWN'),
            message: String((data.error as Record<string, unknown>).message || 'Unknown error'),
          }
        : undefined,
    };
  }
}
