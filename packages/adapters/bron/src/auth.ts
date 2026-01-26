/**
 * Bron OAuth2 Authentication Client
 * 
 * Handles OAuth2 flows for Bron enterprise wallet.
 * 
 * References:
 * - Bron developer portal: https://developer.bron.org/
 * - Bron ecosystem: https://www.canton.network/ecosystem/bron-wallet
 */

import type { StorageAdapter } from '@cantonconnect/core';

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
  /** Use PKCE (recommended for browser) */
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

  constructor(config: BronAuthConfig, storage?: StorageAdapter) {
    this.config = config;
    this.storage = storage;
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const verifier = this.generateRandomString(128);
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
      
      // Store verifier temporarily (in sessionStorage)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bron_pkce_verifier', pkce.verifier);
        sessionStorage.setItem('bron_auth_state', state);
      }
    } else {
      // Store state
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bron_auth_state', state);
      }
    }

    const authUrl = `${this.config.authorizationUrl}?${params.toString()}`;
    return authUrl;
  }

  /**
   * Finish authorization flow with callback URL
   */
  async finishAuth(callbackUrl: string): Promise<BronTokens> {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code in callback');
    }

    // Validate state
    if (typeof window !== 'undefined') {
      const storedState = sessionStorage.getItem('bron_auth_state');
      if (state !== storedState) {
        throw new Error('State mismatch');
      }
    }

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
    });

    // Add PKCE verifier if used
    if (this.config.usePKCE && typeof window !== 'undefined') {
      const verifier = sessionStorage.getItem('bron_pkce_verifier');
      if (verifier) {
        tokenParams.set('code_verifier', verifier);
        sessionStorage.removeItem('bron_pkce_verifier');
      }
    }

    // Add client secret for server-side flow
    if (this.config.clientSecret) {
      tokenParams.set('client_secret', this.config.clientSecret);
    }

    // Request tokens
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    const tokens: BronTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      tokenType: tokenData.token_type || 'Bearer',
    };

    // Store tokens (in memory by default, or encrypted storage if configured)
    this.tokens = tokens;
    if (this.storage) {
      // Store encrypted (implementation depends on storage adapter)
      await this.storage.set('bron_tokens', JSON.stringify(tokens));
    }

    // Clean up session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('bron_auth_state');
    }

    return tokens;
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    // Check if token exists and is not expired
    if (this.tokens && Date.now() < this.tokens.expiresAt) {
      return this.tokens.accessToken;
    }

    // Try to load from storage
    if (this.storage) {
      const stored = await this.storage.get('bron_tokens');
      if (stored) {
        this.tokens = JSON.parse(stored) as BronTokens;
        if (Date.now() < this.tokens.expiresAt) {
          return this.tokens.accessToken;
        }
      }
    }

    return null;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    this.tokens = null;
    if (this.storage) {
      await this.storage.remove('bron_tokens');
    }
  }
}
