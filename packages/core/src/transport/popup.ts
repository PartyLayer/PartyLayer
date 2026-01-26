/**
 * Popup Transport
 * 
 * Opens a centered popup window and establishes a postMessage channel.
 * 
 * Security:
 * - Origin validation
 * - State parameter validation
 * - Popup window management
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
 * Popup transport implementation
 */
export class PopupTransport implements Transport {
  /**
   * Generate a random state nonce
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
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
   * Open popup window
   */
  private openPopup(url: string, _options: TransportOptions): Window | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return window.open(
      url,
      'CantonConnect',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  /**
   * Wait for postMessage callback
   */
  private async waitForCallback<T extends { state: string }>(
    popup: Window,
    state: string,
    options: TransportOptions,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        popup.close();
        reject(new Error('Transport timeout'));
      }, timeoutMs);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Popup closed by user'));
        }
      }, 500);

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
          popup.close();
          resolve(data as T);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(checkClosed);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', messageHandler);
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', messageHandler);
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

    // Build URL
    const fullUrl = this.buildUrl(url, request);

    // Open popup
    const popup = this.openPopup(fullUrl, options);
    if (!popup) {
      throw new Error('Failed to open popup window');
    }

    // Wait for callback
    const timeout = options.timeoutMs || 60000;
    const response = await this.waitForCallback<ConnectResponse>(
      popup,
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

    // Build URL
    const fullUrl = this.buildUrl(url, request);

    // Open popup
    const popup = this.openPopup(fullUrl, options);
    if (!popup) {
      throw new Error('Failed to open popup window');
    }

    // Wait for callback
    const timeout = options.timeoutMs || 60000;
    const response = await this.waitForCallback<SignResponse>(
      popup,
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
