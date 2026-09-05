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
 * A `Transport` that answers from a table of preset responses instead of the
 * network. Drive it directly in a transport-level test.
 *
 * @deprecated Not deprecated because it is bad — deprecated because nothing calls
 * it, and an export with no callers gets deleted by the next person tidying up.
 * Read this before doing that.
 *
 * Three things are true about it, and all three matter:
 *
 * 1. **Its entry point was removed.** Adapters used to accept a
 *    `useMockTransport` config flag that swapped this in beneath them. That flag
 *    was deleted in `703a645` (the Cantor8 rebuild on its real SDK); see
 *    `packages/adapters/cantor8/CHANGELOG.md`. The class outlived its only
 *    caller, and `docs/transports.md` went on instructing consumers to pass the
 *    removed flag long after it was gone.
 * 2. **It has no consumers today.** Nothing in this repository constructs it
 *    except its own test. That is a fact about our coverage, not a verdict on the
 *    class.
 * 3. **It is retained deliberately.** It implements `openConnectRequest`,
 *    `openSignRequest` and `pollJobStatus` — the popup and deep-link surface —
 *    which is exactly the transport family no end-to-end test currently reaches.
 *    The demo's `window.canton` provider fixture cannot get there by
 *    construction. If we close that gap, this is the building block, and it
 *    should be used to build a FIXTURE AT THE TRANSPORT BOUNDARY: a stub popup or
 *    relay endpoint the real code path talks to. It must not be reintroduced as a
 *    constructor flag or an environment switch. An env-keyed mock branch is
 *    reachable from a production bundle, and that makes it the wrong shape even
 *    when it would buy coverage — which is why the flag was removed rather than
 *    repaired.
 *
 * Removing this export is a breaking change to `@partylayer/core` and needs a
 * major bump plus a changeset. Deleting it because "nothing uses it" would
 * discard the one piece of the popup/relay story we still have.
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
      return mockResponse;
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
      return mockResponse;
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
  pollJobStatus(
    jobId: string,
    _statusUrl: string,
    _options: TransportOptions
  ): Promise<JobStatus> {
    // Check for mock job
    const mockJob = this.mockJobs.get(jobId);
    if (mockJob) {
      return Promise.resolve(mockJob);
    }

    // Default mock: approved immediately
    return Promise.resolve({
      jobId,
      status: 'approved',
      result: {
        signature: 'mock-signature',
        transactionHash: 'mock-tx-hash',
      },
    });
  }
}
