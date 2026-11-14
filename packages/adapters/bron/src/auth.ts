/**
 * Bron OAuth2 Authentication Client
 * 
 * Handles OAuth2 flows for Bron enterprise wallet.
 * 
 * References:
 * - Bron developer portal: https://developer.bron.org/
 * - Bron ecosystem: https://www.canton.network/ecosystem/bron-wallet
 */

import type { StorageAdapter } from '@partylayer/core';

/**
 * OAuth2 configuration
 */
export interface BronAuthConfig {
  /** Authorization server URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** Client ID */
  clientId: string;
  /** Client secret (for server-side flows) */
  clientSecret?: string;
  /** Redirect URI */
  redirectUri: string;
  /** Scopes */
  scopes?: string[];
  /** PKCE defaults to true and is required in browsers. */
  usePKCE?: boolean;
}

/**
 * OAuth2 tokens
 */
export interface BronTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
}

/**
 * Bron OAuth2 client
 */
export class BronAuthClient {
  private config: BronAuthConfig;
  private storage?: StorageAdapter;
  private tokens: BronTokens | null = null; // In-memory by default
  private pending: { state: string; verifier?: string; expiresAt: number } | null = null;
  private exchange: AbortController | null = null;
  private authorization = new AbortController();
  private epoch = 0;
  private storageWrites: Promise<void> = Promise.resolve();

  private persist(action: () => Promise<void>): Promise<void> {
    const write = this.storageWrites.catch(() => {}).then(action);
    this.storageWrites = write;
    return write;
  }

  constructor(config: BronAuthConfig, storage?: StorageAdapter) {
    for (const input of [config.authorizationUrl, config.tokenUrl, config.redirectUri]) {
      const url = new URL(input);
      if (url.username || url.password || url.hash || (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('OAuth requires trusted HTTPS URLs');
    }
    if (!config.clientId?.trim()) throw new Error('OAuth clientId is required');
    if (typeof window !== 'undefined' && (config.clientSecret || config.usePKCE === false)) throw new Error('Browser OAuth requires PKCE and must not contain a client secret');
    this.config = { ...config, usePKCE: config.usePKCE ?? true };
    this.storage = storage;
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    // 32 random bytes produce a 64-character RFC 7636 verifier (43–128 chars).
    const verifier = this.generateRandomString(32);
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { verifier, challenge };
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Start authorization flow
   */
  async startAuth(): Promise<string> {
    this.cancelAuthorization();
    this.authorization = new AbortController();
    const epoch = this.epoch;
    const state = this.generateRandomString(32);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: (this.config.scopes || ['openid', 'profile']).join(' '),
    });

    // Add PKCE if enabled
    if (this.config.usePKCE) {
      const pkce = await this.generatePKCE();
      params.set('code_challenge', pkce.challenge);
      params.set('code_challenge_method', 'S256');
      
      if (epoch !== this.epoch) throw new Error('OAuth authorization cancelled');
      this.pending = { state, verifier: pkce.verifier, expiresAt: Date.now() + 300_000 };
    } else {
      this.pending = { state, expiresAt: Date.now() + 300_000 };
    }

    const url = new URL(this.config.authorizationUrl);
    for (const [key, value] of params) url.searchParams.set(key, value);
    return url.href;
  }

  /**
   * Finish authorization flow with callback URL
   */
  async finishAuth(callbackUrl: string): Promise<BronTokens> {
    const url = new URL(callbackUrl);
    const redirect = new URL(this.config.redirectUri);
    const pending = this.pending;
    if (url.origin !== redirect.origin || url.pathname !== redirect.pathname || url.hash || url.username || url.password ||
      [...redirect.searchParams].some(([key, value]) => url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== value) ||
      !pending || pending.expiresAt <= Date.now() || url.searchParams.getAll('state').length !== 1 ||
      url.searchParams.get('state') !== pending.state) throw new Error('Invalid or expired OAuth callback state');
    // Consume before the asynchronous token request, including provider errors.
    this.pending = null;
    if (url.searchParams.has('error')) throw new Error('OAuth authorization was declined or failed');
    const code = url.searchParams.get('code');
    if (!code || url.searchParams.getAll('code').length !== 1) throw new Error('No unique authorization code in callback');
    const tokenParams = new URLSearchParams({ grant_type: 'authorization_code', code,
      redirect_uri: this.config.redirectUri, client_id: this.config.clientId });
    if (this.config.usePKCE) {
      if (!pending.verifier) throw new Error('Missing PKCE verifier');
      tokenParams.set('code_verifier', pending.verifier);
    }
    if (this.config.clientSecret) tokenParams.set('client_secret', this.config.clientSecret);
    const epoch = this.epoch;
    const controller = new AbortController(); this.exchange = controller;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: tokenParams.toString(), credentials: 'omit', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      if (!response.ok) throw new Error('OAuth token exchange failed');
      const raw = await response.text();
      if (raw.length > 256_000) throw new Error('OAuth token response is too large');
      const data = JSON.parse(raw);
      if (!data || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 64_000 ||
        /[\s\p{Cc}]/u.test(data.access_token) || typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer' ||
        typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || data.expires_in > 31_536_000 ||
        (data.refresh_token !== undefined && (typeof data.refresh_token !== 'string' || !data.refresh_token || /\p{Cc}/u.test(data.refresh_token)))) {
        throw new Error('Invalid OAuth token response');
      }
      if (controller.signal.aborted || epoch !== this.epoch) throw new Error('OAuth authorization cancelled');
      const tokens: BronTokens = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: 'Bearer', ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}) };
      this.tokens = tokens;
      // A custom storage adapter is app-owned; it is not encrypted by this class.
      if (this.storage) await this.persist(async () => {
        if (epoch === this.epoch) await this.storage!.set('bron_tokens', JSON.stringify(tokens));
      });
      if (epoch !== this.epoch) throw new Error('OAuth authorization cancelled');
      return tokens;
    } finally {
      clearTimeout(timer); if (this.exchange === controller) this.exchange = null;
    }
  }

  /** Clear authorization state and abort only the in-flight token exchange. */
  cancelAuthorization(): void {
    this.authorization.abort();
    this.epoch++; this.pending = null; this.exchange?.abort(); this.exchange = null;
  }

  getAuthorizationSignal(): AbortSignal { return this.authorization.signal; }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    const epoch = this.epoch;
    // Check if token exists and is not expired
    if (this.tokens && Date.now() < this.tokens.expiresAt) {
      return this.tokens.accessToken;
    }

    // Try to load from storage
    if (this.storage) {
      const stored = await this.storage.get('bron_tokens');
      if (epoch !== this.epoch) return null;
      if (stored) {
        try {
          const tokens = JSON.parse(stored) as BronTokens;
          if (typeof tokens.accessToken === 'string' && tokens.accessToken && !/[\s\p{Cc}]/u.test(tokens.accessToken) &&
            tokens.tokenType === 'Bearer' && Number.isFinite(tokens.expiresAt) && Date.now() < tokens.expiresAt) {
            this.tokens = tokens; return tokens.accessToken;
          }
        } catch { /* Invalid persisted data never establishes an authenticated session. */ }
      }
    }

    return null;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    this.cancelAuthorization();
    this.tokens = null;
    if (this.storage) {
      await this.persist(() => this.storage!.remove('bron_tokens'));
    }
  }
}
