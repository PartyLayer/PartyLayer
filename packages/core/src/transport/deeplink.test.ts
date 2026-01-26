/**
 * DeepLinkTransport Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeepLinkTransport } from './deeplink';
import type { ConnectRequest, TransportOptions } from './types';

describe('DeepLinkTransport', () => {
  let transport: DeepLinkTransport;
  let originalWindow: typeof window;
  let messageHandlers: Array<(event: MessageEvent) => void> = [];

  beforeEach(() => {
    transport = new DeepLinkTransport();
    
    // Store original window
    originalWindow = global.window;
    
    // Mock window.open to return a mock window
    const mockOpenWindow = {
      closed: false,
      close: vi.fn(),
    } as unknown as Window;
    
    // Mock window object
    global.window = {
      location: {
        href: '',
        hash: '',
      },
      open: vi.fn(() => mockOpenWindow), // Return mock window so deep link doesn't fail
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent | HashChangeEvent) => void) => {
        if (event === 'message' || event === 'hashchange') {
          messageHandlers.push(handler as (event: MessageEvent) => void);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: (event: MessageEvent | HashChangeEvent) => void) => {
        if (event === 'message' || event === 'hashchange') {
          messageHandlers = messageHandlers.filter((h) => h !== handler);
        }
      }),
      dispatchEvent: vi.fn((event: Event) => {
        if (event.type === 'message') {
          messageHandlers.forEach((handler) => handler(event as MessageEvent));
        }
        return true;
      }),
    } as unknown as typeof window;
  });

  afterEach(() => {
    global.window = originalWindow;
    messageHandlers = [];
  });

  describe('state validation', () => {
    it('should validate state in callback', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state-123',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        allowedOrigins: ['https://test.com'],
        timeoutMs: 1000,
      };

      // Mock postMessage callback
      const callbackPromise = transport.openConnectRequest(
        'mywallet://connect',
        request,
        options
      );

      // Simulate callback with matching state
      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://test.com',
          data: {
            state: 'test-state-123',
            partyId: 'party::test',
          },
        });
        window.dispatchEvent(event);
      }, 100);

      await expect(callbackPromise).resolves.toMatchObject({
        state: 'test-state-123',
        partyId: expect.anything(),
      });
    }, 2000);

    it('should reject callback with mismatched state', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state-123',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        allowedOrigins: ['https://test.com'],
        timeoutMs: 500,
      };

      const callbackPromise = transport.openConnectRequest(
        'mywallet://connect',
        request,
        options
      );

      // Simulate callback with mismatched state (should be ignored)
      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://test.com',
          data: {
            state: 'wrong-state',
            partyId: 'party::test',
          },
        });
        window.dispatchEvent(event);
      }, 100);

      // Should timeout (mismatched state ignored)
      await expect(callbackPromise).rejects.toThrow();
    }, 2000);
  });

  describe('origin validation', () => {
    it('should accept callback from allowed origin', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        allowedOrigins: ['https://test.com', 'https://app.test.com'],
        timeoutMs: 1000,
      };

      const callbackPromise = transport.openConnectRequest(
        'mywallet://connect',
        request,
        options
      );

      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://app.test.com',
          data: {
            state: 'test-state',
            partyId: 'party::test',
          },
        });
        window.dispatchEvent(event);
      }, 100);

      await expect(callbackPromise).resolves.toBeDefined();
    }, 2000);

    it('should reject callback from disallowed origin', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        allowedOrigins: ['https://test.com'],
        timeoutMs: 500,
      };

      const callbackPromise = transport.openConnectRequest(
        'mywallet://connect',
        request,
        options
      );

      // Simulate callback from disallowed origin (should be ignored)
      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://evil.com',
          data: {
            state: 'test-state',
            partyId: 'party::test',
          },
        });
        window.dispatchEvent(event);
      }, 100);

      // Should timeout (disallowed origin ignored)
      await expect(callbackPromise).rejects.toThrow();
    }, 2000);
  });

  describe('timeout behavior', () => {
    it('should timeout after specified duration', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 200,
      };

      const callbackPromise = transport.openConnectRequest(
        'mywallet://connect',
        request,
        options
      );

      await expect(callbackPromise).rejects.toThrow('Transport timeout');
    }, 500);
  });
});
