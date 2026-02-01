/**
 * PopupTransport Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PopupTransport } from './popup';
import type { ConnectRequest, TransportOptions } from './types';

describe('PopupTransport', () => {
  let transport: PopupTransport;
  let originalWindow: typeof window;
  let mockPopup: Window;
  let messageHandlers: Array<(event: MessageEvent) => void> = [];
  let checkClosedInterval: ReturnType<typeof setInterval> | null = null;

  beforeEach(() => {
    transport = new PopupTransport();
    
    originalWindow = global.window;
    
    mockPopup = {
      closed: false,
      close: vi.fn(),
    } as unknown as Window;
    
    global.window = {
      screenX: 100,
      screenY: 100,
      outerWidth: 1920,
      outerHeight: 1080,
      open: vi.fn(() => mockPopup),
      addEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (event === 'message') {
          messageHandlers.push(handler);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: (event: MessageEvent) => void) => {
        if (event === 'message') {
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
    
    // Don't override setInterval - let it work normally
    // The popup transport will use the real setInterval
  });

  afterEach(() => {
    global.window = originalWindow;
    messageHandlers = [];
    if (checkClosedInterval) {
      clearInterval(checkClosedInterval);
      checkClosedInterval = null;
    }
  });

  describe('postMessage handshake', () => {
    it('should validate message origin', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        allowedOrigins: ['https://test.com'],
        timeoutMs: 1000,
      };

      const callbackPromise = transport.openConnectRequest(
        'https://wallet.test.com/connect',
        request,
        options
      );

      // Simulate postMessage from allowed origin
      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://test.com',
          data: {
            state: 'test-state',
            partyId: 'party::test',
          },
        });
        // Dispatch to all registered handlers
        messageHandlers.forEach((handler) => handler(event));
      }, 100);

      await expect(callbackPromise).resolves.toBeDefined();
    }, 2000);

    it('should reject message from disallowed origin', async () => {
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
        'https://wallet.test.com/connect',
        request,
        options
      );

      // Simulate postMessage from disallowed origin (should be ignored)
      setTimeout(() => {
        const event = new MessageEvent('message', {
          origin: 'https://evil.com',
          data: {
            state: 'test-state',
            partyId: 'party::test',
          },
        });
        // Dispatch to all registered handlers
        messageHandlers.forEach((handler) => handler(event));
      }, 100);

      // Should timeout (disallowed origin ignored)
      await expect(callbackPromise).rejects.toThrow();
    }, 2000);
  });

  describe('popup management', () => {
    it('should open centered popup', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 1000,
      };

      // Call openConnectRequest (will call openPopup internally)
      const promise = transport.openConnectRequest(
        'https://wallet.test.com/connect',
        request,
        options
      ).catch(() => {}); // Ignore timeout

      // Wait a bit for popup to open
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(global.window.open).toHaveBeenCalled();
      const callArgs = (global.window.open as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1]).toBe('PartyLayer');
      expect(callArgs[2]).toContain('width=500');
      expect(callArgs[2]).toContain('height=600');
      
      // Cleanup
      await promise;
    }, 2000);

    it('should detect popup closed by user', async () => {
      const request: ConnectRequest = {
        appName: 'Test',
        origin: 'https://test.com',
        network: 'devnet',
        state: 'test-state',
      };

      const options: TransportOptions = {
        origin: 'https://test.com',
        timeoutMs: 500,
      };

      const callbackPromise = transport.openConnectRequest(
        'https://wallet.test.com/connect',
        request,
        options
      );

      // Simulate popup closed
      setTimeout(() => {
        mockPopup.closed = true;
      }, 100);

      await expect(callbackPromise).rejects.toThrow();
    }, 2000);
  });
});
