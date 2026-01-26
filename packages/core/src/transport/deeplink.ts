/**
 * Deep Link Transport
 * 
 * Opens a deep link URL (mobile) and awaits callback via redirect or postMessage.
 * 
 * Security:
 * - State parameter (nonce) for CSRF protection
 * - Origin validation
 * - Timeout enforcement
 * - Callback origin allowlist
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
 * Deep link transport implementation
 */
export class DeepLinkTransport implements Transport {
  /**
   * Generate a random state nonce
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Build deep link URL with query parameters
   */
  private buildDeepLinkUrl(
    baseUrl: string,
    request: ConnectRequest | SignRequest
  ): string {
    const url = new URL(baseUrl);
    Object.entries(request).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, JSON.stringify(value));
        } else if (typeof value === 'object') {
          url.searchParams.set(key, JSON.stringify(value));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
    return url.toString();
  }

  /**
   * Validate callback origin
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
   * Wait for callback via postMessage or redirect
   */
  private async waitForCallback<T extends { state: string }>(
    state: string,
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
        if (data && data.state === state) {
          cleanup();
          resolve(data as T);
        }
      };

      const redirectHandler = () => {
        // Check URL hash/fragment for callback data
        if (typeof window !== 'undefined') {
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const callbackState = params.get('state');
          if (callbackState === state) {
            const data: T = {} as T;
            params.forEach((value, key) => {
              (data as Record<string, unknown>)[key] = value;
            });
            cleanup();
            resolve(data);
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', messageHandler);
          window.removeEventListener('hashchange', redirectHandler);
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', messageHandler);
        window.addEventListener('hashchange', redirectHandler);
        // Also check current hash immediately
        redirectHandler();
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
    // Ensure state is set
    if (!request.state) {
      request.state = this.generateState();
    }

    // Build deep link URL
    const deepLinkUrl = this.buildDeepLinkUrl(url, request);

    // Open deep link (mobile) or window (desktop fallback)
    if (typeof window !== 'undefined') {
      // Try to open deep link
      window.location.href = deepLinkUrl;

      // Fallback: open in new window if deep link fails
      // (This is a simulation - real mobile apps would handle the deep link)
      const fallbackWindow = window.open(deepLinkUrl, '_blank');
      if (!fallbackWindow) {
        throw new Error('Failed to open deep link');
      }
    }

    // Wait for callback
    const timeout = options.timeoutMs || 60000; // Default 60s
    const response = await this.waitForCallback<ConnectResponse>(
      request.state,
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
    // Ensure state is set
    if (!request.state) {
      request.state = this.generateState();
    }

    // Build deep link URL
    const deepLinkUrl = this.buildDeepLinkUrl(url, request);

    // Open deep link
    if (typeof window !== 'undefined') {
      window.location.href = deepLinkUrl;
    }

    // Wait for callback
    const timeout = options.timeoutMs || 60000;
    const response = await this.waitForCallback<SignResponse>(
      request.state,
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
