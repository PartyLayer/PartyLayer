/**
 * PostMessage Transport
 * 
 * Establishes a postMessage channel with an existing window/iframe.
 * 
 * Security:
 * - Origin validation
 * - State parameter validation
 */

import type {
  Transport,
  TransportOptions,
  ConnectRequest,
  ConnectResponse,
  SignRequest,
  SignResponse,
} from './types';

/**
 * PostMessage transport implementation
 */
export class PostMessageTransport implements Transport {
  /**
   * Generate a random state nonce
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate message origin
   */
  private validateOrigin(
    origin: string,
    options: TransportOptions
  ): void {
    if (options.allowedOrigins && options.allowedOrigins.length > 0) {
      if (!options.allowedOrigins.includes(origin)) {
        throw new Error(`Origin ${origin} not allowed`);
      }
    }
  }

  /**
   * Send message and wait for response
   */
  private async sendAndWait<T extends { state: string }>(
    target: Window,
    targetOrigin: string,
    message: ConnectRequest | SignRequest,
    options: TransportOptions,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Transport timeout'));
      }, timeoutMs);

      const messageHandler = (event: MessageEvent) => {
        // Validate origin
        try {
          this.validateOrigin(event.origin, options);
        } catch (err) {
          return; // Ignore messages from disallowed origins
        }

        // Check if message matches our request
        const data = event.data as T & { type?: string };
        if (data && data.state === message.state) {
          cleanup();
          resolve(data as T);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', messageHandler);
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', messageHandler);
        target.postMessage(message, targetOrigin);
      }
    });
  }

  /**
   * Open a connection request
   */
  async openConnectRequest(
    url: string,
    request: ConnectRequest,
    options: TransportOptions
  ): Promise<ConnectResponse> {
    if (typeof window === 'undefined') {
      throw new Error('PostMessage transport requires browser environment');
    }

    // Ensure state is set
    if (!request.state) {
      request.state = this.generateState();
    }

    // Parse target origin from URL
    const targetUrl = new URL(url);
    const targetOrigin = targetUrl.origin;

    // Get target window (could be parent, opener, or specific iframe)
    // For now, assume we're communicating with parent/opener
    const target = window.opener || window.parent;

    if (!target || target === window) {
      throw new Error('No target window available for postMessage');
    }

    // Send message and wait for response
    const timeout = options.timeoutMs || 60000;
    const response = await this.sendAndWait<ConnectResponse>(
      target,
      targetOrigin,
      request,
      options,
      timeout
    );

    // Validate state matches
    if (response.state !== request.state) {
      throw new Error('State mismatch in callback');
    }

    return response;
  }

  /**
   * Open a sign request
   */
  async openSignRequest(
    url: string,
    request: SignRequest,
    options: TransportOptions
  ): Promise<SignResponse> {
    if (typeof window === 'undefined') {
      throw new Error('PostMessage transport requires browser environment');
    }

    // Ensure state is set
    if (!request.state) {
      request.state = this.generateState();
    }

    // Parse target origin from URL
    const targetUrl = new URL(url);
    const targetOrigin = targetUrl.origin;

    // Get target window
    const target = window.opener || window.parent;

    if (!target || target === window) {
      throw new Error('No target window available for postMessage');
    }

    // Send message and wait for response
    const timeout = options.timeoutMs || 60000;
    const response = await this.sendAndWait<SignResponse>(
      target,
      targetOrigin,
      request,
      options,
      timeout
    );

    // Validate state matches
    if (response.state !== request.state) {
      throw new Error('State mismatch in callback');
    }

    return response;
  }
}
