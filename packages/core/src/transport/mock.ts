/**
 * Mock Transport
 * 
 * For testing and development. Simulates transport behavior without real network calls.
 */

import type {
  Transport,
  TransportOptions,
  ConnectRequest,
  ConnectResponse,
  SignRequest,
  SignResponse,
  JobStatus,
} from './types';
import { toPartyId } from '../types';

/**
 * Mock transport implementation
 */
export class MockTransport implements Transport {
  private mockResponses: Map<string, ConnectResponse | SignResponse> = new Map();
  private mockJobs: Map<string, JobStatus> = new Map();

  /**
   * Set mock response for a state
   */
  setMockResponse(state: string, response: ConnectResponse | SignResponse): void {
    this.mockResponses.set(state, response);
  }

  /**
   * Set mock job status
   */
  setMockJob(jobId: string, status: JobStatus): void {
    this.mockJobs.set(jobId, status);
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    this.mockResponses.clear();
    this.mockJobs.clear();
  }

  /**
   * Open a connection request (mock)
   */
  async openConnectRequest(
    _url: string,
    request: ConnectRequest,
    _options: TransportOptions
  ): Promise<ConnectResponse> {
    // Check for mock response
    const mockResponse = this.mockResponses.get(request.state);
    if (mockResponse && 'partyId' in mockResponse) {
      return mockResponse as ConnectResponse;
    }

    // Default mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          state: request.state,
          partyId: toPartyId('mock-party-' + Date.now()),
          sessionToken: 'mock-token',
          expiresAt: Date.now() + 3600000, // 1 hour
          capabilities: request.requestedCapabilities || ['connect', 'signMessage'],
        });
      }, 100); // Simulate async delay
    });
  }

  /**
   * Open a sign request (mock)
   */
  async openSignRequest(
    _url: string,
    request: SignRequest,
    _options: TransportOptions
  ): Promise<SignResponse> {
    // Check for mock response
    const mockResponse = this.mockResponses.get(request.state);
    if (mockResponse && ('signature' in mockResponse || 'jobId' in mockResponse)) {
      return mockResponse as SignResponse;
    }

    // Default mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          state: request.state,
          signature: 'mock-signature-' + Date.now(),
          transactionHash: request.transaction ? 'mock-tx-hash' : undefined,
        });
      }, 100);
    });
  }

  /**
   * Poll job status (mock)
   */
  async pollJobStatus(
    jobId: string,
    _statusUrl: string,
    _options: TransportOptions
  ): Promise<JobStatus> {
    // Check for mock job
    const mockJob = this.mockJobs.get(jobId);
    if (mockJob) {
      return mockJob;
    }

    // Default mock: approved immediately
    return {
      jobId,
      status: 'approved',
      result: {
        signature: 'mock-signature',
        transactionHash: 'mock-tx-hash',
      },
    };
  }
}
