/**
 * Cantor8 Vendor Integration Module
 * 
 * This module abstracts vendor-specific endpoints and can be swapped
 * without breaking the adapter API.
 * 
 * References:
 * - Cantor8 ecosystem: https://www.canton.network/ecosystem/cantor8
 * - Cantor8 site: https://cantor8.tech/about
 */

import type {
  ConnectRequest,
  ConnectResponse,
  SignRequest,
  SignResponse,
  JobStatus,
} from '@cantonconnect/core';
import { toPartyId } from '@cantonconnect/core';

/**
 * Vendor configuration
 */
export interface Cantor8VendorConfig {
  /** Deep link scheme (e.g., "cantor8") */
  deepLinkScheme?: string;
  /** Universal link base URL (e.g., "https://app.cantor8.tech") */
  universalLinkBase?: string;
  /** Connect endpoint path */
  connectEndpoint?: string;
  /** Sign endpoint path */
  signEndpoint?: string;
  /** Job status endpoint path (for async approvals) */
  statusEndpoint?: string;
  /** Redirect URI for callbacks */
  redirectUri?: string;
}

/**
 * Vendor module interface
 * 
 * Implementations can be swapped without changing adapter code.
 */
export interface Cantor8VendorModule {
  /**
   * Create connect URL
   */
  createConnectUrl(request: ConnectRequest, config: Cantor8VendorConfig): string;

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
  createSignUrl(request: SignRequest, config: Cantor8VendorConfig): string;

  /**
   * Parse sign callback
   */
  parseSignCallback(
    callbackData: unknown,
    expectedState: string
  ): SignResponse;

  /**
   * Poll job status (optional, for async approvals)
   */
  pollJobStatus?(
    jobId: string,
    statusUrl: string,
    timeoutMs: number
  ): Promise<JobStatus>;
}

/**
 * Default/stub vendor module
 * 
 * This implementation provides a structured interface but throws
 * NotConfiguredError with clear instructions when vendor endpoints
 * are not configured.
 */
export class StubCantor8VendorModule implements Cantor8VendorModule {
  createConnectUrl(request: ConnectRequest, config: Cantor8VendorConfig): string {
    // Prefer universal link if configured
    if (config.universalLinkBase) {
      const endpoint = config.connectEndpoint || '/connect';
      const url = new URL(endpoint, config.universalLinkBase);
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      return url.toString();
    }

    // Fallback to deep link scheme
    if (config.deepLinkScheme) {
      const params = new URLSearchParams();
      Object.entries(request).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      return `${config.deepLinkScheme}://connect?${params.toString()}`;
    }

    throw new Error(
      'Cantor8 vendor not configured. Please set deepLinkScheme or universalLinkBase in adapter config.'
    );
  }

  parseConnectCallback(
    callbackData: unknown,
    expectedState: string
  ): ConnectResponse {
    // Parse callback data (could be URL params, postMessage, etc.)
    const data = callbackData as Record<string, unknown>;

    // Validate state
    if (data.state !== expectedState) {
      throw new Error('State mismatch in callback');
    }

    // Return response
    return {
      state: String(data.state),
      partyId: data.partyId ? toPartyId(String(data.partyId)) : undefined,
      sessionToken: data.sessionToken ? String(data.sessionToken) : undefined,
      expiresAt: data.expiresAt ? Number(data.expiresAt) : undefined,
      capabilities: data.capabilities
        ? (Array.isArray(data.capabilities) ? data.capabilities.map(String) : [])
        : undefined,
      error: data.error
        ? {
            code: String((data.error as Record<string, unknown>).code || 'UNKNOWN'),
            message: String((data.error as Record<string, unknown>).message || 'Unknown error'),
          }
        : undefined,
    };
  }

  createSignUrl(request: SignRequest, config: Cantor8VendorConfig): string {
    if (config.universalLinkBase) {
      const endpoint = config.signEndpoint || '/sign';
      const url = new URL(endpoint, config.universalLinkBase);
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
      return `${config.deepLinkScheme}://sign?${params.toString()}`;
    }

    throw new Error('Cantor8 vendor not configured');
  }

  parseSignCallback(
    callbackData: unknown,
    expectedState: string
  ): SignResponse {
    const data = callbackData as Record<string, unknown>;

    if (data.state !== expectedState) {
      throw new Error('State mismatch in callback');
    }

    return {
      state: String(data.state),
      signature: data.signature ? String(data.signature) : undefined,
      transactionHash: data.transactionHash ? String(data.transactionHash) : undefined,
      jobId: data.jobId ? String(data.jobId) : undefined,
      error: data.error
        ? {
            code: String((data.error as Record<string, unknown>).code || 'UNKNOWN'),
            message: String((data.error as Record<string, unknown>).message || 'Unknown error'),
          }
        : undefined,
    };
  }
}
