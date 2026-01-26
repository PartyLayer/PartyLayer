/**
 * Transport layer types for wallet communication
 * 
 * Supports deep link, popup, and postMessage transports for mobile and web wallets.
 */

import type { PartyId } from '../types';

/**
 * Transport type
 */
export type TransportType = 'deeplink' | 'popup' | 'postmessage' | 'injected';

/**
 * Transport options
 */
export interface TransportOptions {
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Allowed callback origins */
  allowedOrigins?: string[];
  /** Current origin for validation */
  origin: string;
}

/**
 * Connect request payload
 */
export interface ConnectRequest {
  appName: string;
  origin: string;
  network: string;
  requestedCapabilities?: string[];
  state: string; // Nonce for CSRF protection
  redirectUri?: string;
}

/**
 * Connect response payload
 */
export interface ConnectResponse {
  state: string;
  partyId?: PartyId;
  sessionToken?: string;
  expiresAt?: number;
  capabilities?: string[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Sign request payload
 */
export interface SignRequest {
  message?: string;
  transaction?: unknown;
  state: string;
  redirectUri?: string;
}

/**
 * Sign response payload
 */
export interface SignResponse {
  state: string;
  signature?: string;
  transactionHash?: string;
  jobId?: string; // For async approval flows
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Job status (for async approval flows)
 */
export interface JobStatus {
  jobId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  result?: {
    signature?: string;
    transactionHash?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transport interface
 */
export interface Transport {
  /**
   * Open a connection request
   */
  openConnectRequest(
    url: string,
    request: ConnectRequest,
    options: TransportOptions
  ): Promise<ConnectResponse>;

  /**
   * Open a sign request
   */
  openSignRequest(
    url: string,
    request: SignRequest,
    options: TransportOptions
  ): Promise<SignResponse>;

  /**
   * Poll job status (if supported)
   */
  pollJobStatus?(
    jobId: string,
    statusUrl: string,
    options: TransportOptions
  ): Promise<JobStatus>;
}
