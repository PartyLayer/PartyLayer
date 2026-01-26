/**
 * Bron API Client
 * 
 * Typed client for Bron enterprise wallet API endpoints.
 * 
 * References:
 * - Bron developer portal: https://developer.bron.org/
 */

import type { PartyId } from '@cantonconnect/core';
import { toPartyId } from '@cantonconnect/core';

/**
 * Bron API configuration
 */
export interface BronApiConfig {
  /** Base API URL */
  baseUrl: string;
  /** Access token getter */
  getAccessToken: () => Promise<string | null>;
}

/**
 * Session/Party mapping
 */
export interface BronSession {
  sessionId: string;
  partyId: PartyId;
  expiresAt?: number;
}

/**
 * Signature request
 */
export interface BronSignRequest {
  message?: string;
  transaction?: unknown;
  sessionId: string;
}

/**
 * Signature response
 */
export interface BronSignResponse {
  requestId: string;
  status: 'pending' | 'approved' | 'denied';
  signature?: string;
  transactionHash?: string;
}

/**
 * Request status
 */
export interface BronRequestStatus {
  requestId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  signature?: string;
  transactionHash?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Bron API client
 */
export class BronApiClient {
  private config: BronApiConfig;

  constructor(config: BronApiConfig) {
    this.config = config;
  }

  /**
   * Create authenticated request headers
   */
  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.config.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create session / get party mapping
   */
  async createSession(): Promise<BronSession> {
    // In mock mode, return mock data
    if (this.config.baseUrl.includes('mock') || this.config.baseUrl.includes('dev')) {
      return {
        sessionId: 'mock-session-' + Date.now(),
        partyId: toPartyId('mock-party-' + Date.now()),
        expiresAt: Date.now() + 3600000,
      };
    }

    const headers = await this.getHeaders();
    const response = await fetch(`${this.config.baseUrl}/sessions`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${error}`);
    }

    const data = (await response.json()) as {
      sessionId: string;
      partyId: string;
      expiresAt?: number;
    };

    return {
      sessionId: data.sessionId,
      partyId: toPartyId(data.partyId),
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Request signature
   */
  async requestSignature(request: BronSignRequest): Promise<BronSignResponse> {
    // In mock mode, return mock response
    if (this.config.baseUrl.includes('mock') || this.config.baseUrl.includes('dev')) {
      return {
        requestId: 'mock-request-' + Date.now(),
        status: 'pending',
      };
    }

    const headers = await this.getHeaders();
    const response = await fetch(`${this.config.baseUrl}/signatures`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to request signature: ${error}`);
    }

    const data = (await response.json()) as {
      requestId: string;
      status: string;
      signature?: string;
      transactionHash?: string;
    };

    return {
      requestId: data.requestId,
      status: data.status as 'pending' | 'approved' | 'denied',
      signature: data.signature,
      transactionHash: data.transactionHash,
    };
  }

  /**
   * Get request status
   */
  async getRequestStatus(requestId: string): Promise<BronRequestStatus> {
    // In mock mode, return approved status
    if (this.config.baseUrl.includes('mock') || this.config.baseUrl.includes('dev')) {
      return {
        requestId,
        status: 'approved',
        signature: 'mock-signature-' + requestId,
        transactionHash: 'mock-tx-hash',
      };
    }

    const headers = await this.getHeaders();
    const response = await fetch(`${this.config.baseUrl}/signatures/${requestId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get request status: ${error}`);
    }

    const data = (await response.json()) as {
      requestId: string;
      status: string;
      signature?: string;
      transactionHash?: string;
      error?: {
        code: string;
        message: string;
      };
    };

    return {
      requestId: data.requestId,
      status: data.status as 'pending' | 'approved' | 'denied' | 'expired',
      signature: data.signature,
      transactionHash: data.transactionHash,
      error: data.error,
    };
  }

  /**
   * Poll request status until complete
   */
  async pollRequestStatus(
    requestId: string,
    timeoutMs: number = 60000,
    intervalMs: number = 2000
  ): Promise<BronRequestStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getRequestStatus(requestId);

      if (status.status === 'approved' || status.status === 'denied' || status.status === 'expired') {
        return status;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Polling timeout');
  }
}
