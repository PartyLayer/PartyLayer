/**
 * MockTransport Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from './mock';
import type { ConnectRequest, SignRequest, TransportOptions } from './types';
import { toPartyId } from '../types';

describe('MockTransport', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  describe('deterministic behavior', () => {
    it('should return consistent mock response for same state', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state-1',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 1000,
      };

      // Set mock response
      transport.setMockResponse('test-state-1', {
        state: 'test-state-1',
        partyId: toPartyId('party::mock'),
        sessionToken: 'mock-token',
      });

      const response1 = await transport.openConnectRequest(
        'mock://connect',
        request,
        options
      );

      const response2 = await transport.openConnectRequest(
        'mock://connect',
        request,
        options
      );

      expect(response1.partyId).toBe(response2.partyId);
      expect(response1.state).toBe('test-state-1');
    });

    it('should generate default mock response if not set', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'auto-generated-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 1000,
      };

      const response = await transport.openConnectRequest(
        'mock://connect',
        request,
        options
      );

      expect(response.partyId).toBeDefined();
      expect(response.state).toBe(request.state);
    });
  });

  describe('sign request', () => {
    it('should return mock signature', async () => {
      const request: SignRequest = {
        message: 'test message',
        state: 'sign-state-1',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 1000,
      };

      transport.setMockResponse('sign-state-1', {
        state: 'sign-state-1',
        signature: 'mock-signature-123',
      });

      const response = await transport.openSignRequest(
        'mock://sign',
        request,
        options
      );

      expect(response.signature).toBe('mock-signature-123');
      expect(response.state).toBe('sign-state-1');
    });
  });

  describe('job polling', () => {
    it('should return mock job status', async () => {
      transport.setMockJob('job-123', {
        jobId: 'job-123',
        status: 'approved',
        result: {
          signature: 'job-signature',
          transactionHash: 'tx-hash',
        },
      });

      const status = await transport.pollJobStatus!(
        'job-123',
        'mock://status',
        {
          origin: 'https://test.com',
          timeoutMs: 1000,
        }
      );

      expect(status.status).toBe('approved');
      expect(status.result?.signature).toBe('job-signature');
    });
  });
});
