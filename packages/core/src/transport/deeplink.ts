/**
 * Deep Link Transport
 *
 * Opens a deep link URL (mobile) and awaits a callback via redirect or postMessage.
 *
 * The two platform primitives, opening a URL and subscribing to inbound callbacks,
 * are supplied through a {@link DeepLinkPlatform} rather than assumed. The browser
 * implementation is the default, so existing consumers behave exactly as before with
 * no change at their call sites. A different runtime (for example React Native) passes
 * its own platform to the constructor.
 *
 * Security:
 * - State parameter (nonce) for CSRF protection
 * - Origin validation (postMessage callbacks)
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
 * A callback delivered to the deep link transport. On native this is a `url`; on the
 * web it is either a postMessage (structured `data` plus its `origin`) or a redirect
 * `url`. Exactly one delivery form is present per callback.
 */
export interface DeepLinkCallback {
  /** A callback URL (a native deep link, or a web redirect). Parsed for params. */
  url?: string;
  /** Structured callback data (a web postMessage). */
  data?: Record<string, unknown>;
  /** The origin of the callback, when known (a web postMessage). Validated by the transport. */
  origin?: string;
}

/**
 * The two platform primitives the deep link transport needs. Supplied so the transport
 * runs on the web (the default) or on another runtime such as React Native (injected).
 */
export interface DeepLinkPlatform {
  /** Open a deep link URL. */
  openUrl(url: string): void;
  /**
   * Subscribe to inbound callbacks (native URLs, or web postMessage and redirect).
   * Returns an unsubscribe function.
   */
  subscribe(onCallback: (callback: DeepLinkCallback) => void): () => void;
}

/** Parse the query and fragment params of a callback URL into a flat record. */
function parseCallbackParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const read = (search: string) => {
    new URLSearchParams(search).forEach((value, key) => {
      out[key] = value;
    });
  };
  try {
    const parsed = new URL(url);
    read(parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search);
    read(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  } catch {
    // Not a fully qualified URL: read whatever fragment or query is present.
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      const end = hashIndex !== -1 ? hashIndex : url.length;
      read(url.slice(queryIndex + 1, end));
    }
    if (hashIndex !== -1) {
      read(url.slice(hashIndex + 1));
    }
  }
  return out;
}

/**
 * The browser deep link platform, built from the original code paths. Opening sets
 * `location.href` and falls back to `window.open`; subscribing listens for `message`
 * and `hashchange`. Every access is guarded, so with no DOM present it is a safe
 * no-op rather than a crash.
 */
export function createBrowserDeepLinkPlatform(): DeepLinkPlatform {
  return {
    openUrl(url: string): void {
      if (typeof window === 'undefined') return;
      // Try to open the deep link.
      window.location.href = url;
      // Fallback: open in a new window if the deep link does not take over.
      const fallbackWindow = window.open(url, '_blank');
      if (!fallbackWindow) {
        throw new Error('Failed to open deep link');
      }
    },
    subscribe(onCallback): () => void {
      if (typeof window === 'undefined') return () => {};
      const messageHandler = (event: MessageEvent) => {
        onCallback({ data: event.data as Record<string, unknown>, origin: event.origin });
      };
      const redirectHandler = () => {
        // Web callbacks come back in the URL fragment, so read the hash only. The
        // deep link URL just opened lives in `location.href` with its own query, and
        // reading that would falsely match our own state.
        onCallback({ url: window.location.hash });
      };
      window.addEventListener('message', messageHandler);
      window.addEventListener('hashchange', redirectHandler);
      // Check the current hash on the next microtask, so the caller's unsubscribe is
      // wired before any immediate match fires (preserves the prior immediate check).
      Promise.resolve().then(redirectHandler);
      return () => {
        window.removeEventListener('message', messageHandler);
        window.removeEventListener('hashchange', redirectHandler);
      };
    },
  };
}

/**
 * Deep link transport implementation.
 */
export class DeepLinkTransport implements Transport {
  private readonly platform: DeepLinkPlatform;

  /**
   * @param platform Optional platform primitives. Defaults to the browser platform,
   * so existing consumers (`new DeepLinkTransport()`) behave exactly as before.
   */
  constructor(platform?: DeepLinkPlatform) {
    this.platform = platform ?? createBrowserDeepLinkPlatform();
  }

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
   * Wait for a callback from the platform (postMessage or redirect/native URL).
   */
  private async waitForCallback<T extends { state: string }>(
    state: string,
    options: TransportOptions,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let unsubscribe: () => void = () => {};

      const cleanup = () => {
        clearTimeout(timeout);
        unsubscribe();
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Transport timeout'));
      }, timeoutMs);

      const onCallback = (callback: DeepLinkCallback) => {
        // postMessage form: validate the origin, then match on the data's state.
        if (callback.data !== undefined) {
          try {
            this.validateOrigin(callback.origin ?? '', options);
          } catch {
            return; // Ignore messages from disallowed origins.
          }
          const data = callback.data as T & { state?: string };
          if (data && data.state === state) {
            cleanup();
            resolve(data as T);
          }
          return;
        }
        // URL form (native deep link or web redirect): parse params, match on state.
        if (callback.url !== undefined) {
          const params = parseCallbackParams(callback.url);
          if (params.state === state) {
            cleanup();
            resolve(params as unknown as T);
          }
        }
      };

      unsubscribe = this.platform.subscribe(onCallback);
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

    // Open deep link through the platform primitive.
    this.platform.openUrl(deepLinkUrl);

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

    // Open deep link through the platform primitive.
    this.platform.openUrl(deepLinkUrl);

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
