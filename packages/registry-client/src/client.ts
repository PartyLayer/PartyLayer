/**
 * Registry client for fetching and caching wallet registry
 * 
 * Features:
 * - Ed25519 signature verification
 * - Multi-channel support (stable/beta)
 * - Sequence number validation (prevents downgrades)
 * - Last-known-good caching
 * - SWR pattern (serve cached immediately, refresh in background)
 * - ETag support for efficient updates
 * 
 * References:
 * - Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
 */

import type { WalletInfo } from '@partylayer/core';
import {
  RegistryFetchFailedError,
  RegistryVerificationFailedError,
  RegistrySchemaInvalidError,
  WalletNotFoundError,
} from '@partylayer/core';
import type {
  WalletRegistryV1,
  RegistryWalletEntry,
  RegistryChannel,
  RegistrySignature,
} from './schema';
import {
  validateRegistry,
  validateWalletEntry,
  registryEntryToWalletInfo,
} from './schema';
import type { RegistryStatus, CachedRegistry, LastFetchAttempt } from './status';

/**
 * Registry client options
 */
export interface RegistryClientOptions {
  /** Base registry URL (client appends /v1/{channel}/registry.json) */
  registryUrl?: string;
  /** Registry channel */
  channel?: RegistryChannel;
  /** Public keys for signature verification (base64) */
  registryPublicKeys?: string[];
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTtl?: number;
  /** Stale TTL in milliseconds (default: 24 hours - cache usable but marked stale) */
  staleTtl?: number;
  /** Enable cache (default: true) */
  enableCache?: boolean;
  /** Custom fetch function */
  fetch?: typeof fetch;
  /** Fetch timeout in milliseconds (default: 8000) */
  fetchTimeout?: number;
  /** Storage adapter for persistent cache */
  storage?: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
}

/**
 * Default registry URL
 */
const DEFAULT_REGISTRY_URL = 'https://registry.partylayer.xyz';

/**
 * Registry client
 */
export class RegistryClient {
  private baseUrl: string;
  private channel: RegistryChannel;
  private publicKeys: string[];
  private cacheTtl: number;
  private staleTtl: number;
  private enableCache: boolean;
  private fetchFn: typeof fetch;
  private fetchTimeout: number;
  private storage?: RegistryClientOptions['storage'];

  // In-memory cache
  private memoryCache: {
    lastKnownGood: CachedRegistry | null;
    lastAttempt: LastFetchAttempt | null;
    refreshPromise: Promise<WalletRegistryV1> | null;
  } = {
    lastKnownGood: null,
    lastAttempt: null,
    refreshPromise: null,
  };

  // Status tracking
  private currentStatus: RegistryStatus | null = null;

  constructor(options: RegistryClientOptions = {}) {
    this.baseUrl = options.registryUrl || DEFAULT_REGISTRY_URL;
    this.channel = options.channel || 'stable';
    this.publicKeys = options.registryPublicKeys || [];
    this.cacheTtl = options.cacheTtl || 60 * 60 * 1000; // 1 hour
    this.staleTtl = options.staleTtl || 24 * 60 * 60 * 1000; // 24 hours
    this.enableCache = options.enableCache !== false;
    // Bind fetch to prevent "Illegal invocation" error
    // Use global fetch directly to avoid context issues
    if (options.fetch) {
      this.fetchFn = options.fetch;
    } else if (typeof window !== 'undefined' && window.fetch) {
      this.fetchFn = window.fetch.bind(window);
    } else if (typeof globalThis !== 'undefined' && globalThis.fetch) {
      this.fetchFn = globalThis.fetch.bind(globalThis);
    } else {
      this.fetchFn = fetch;
    }
    this.fetchTimeout = options.fetchTimeout || 8000;
    this.storage = options.storage;

    // Load from persistent storage if available
    if (this.storage) {
      this.loadFromStorage().catch(() => {
        // Ignore errors on load
      });
    }
  }

  /**
   * Get registry URL for channel
   */
  private getRegistryUrl(): string {
    return `${this.baseUrl}/v1/${this.channel}/registry.json`;
  }

  /**
   * Get signature URL for channel
   */
  private getSignatureUrl(): string {
    return `${this.baseUrl}/v1/${this.channel}/registry.sig`;
  }

  /**
   * Import public key from base64
   */
  private async importPublicKey(keyBase64: string): Promise<CryptoKey> {
    const keyBuffer = Buffer.from(keyBase64, 'base64');
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519',
      },
      true,
      ['verify']
    );
  }

  /**
   * Verify signature
   */
  private async verifySignature(
    registryJson: string,
    signature: RegistrySignature,
    publicKey: CryptoKey
  ): Promise<boolean> {
    if (signature.algorithm !== 'ed25519') {
      return false;
    }

    const data = new TextEncoder().encode(registryJson);
    const sigBuffer = Buffer.from(signature.signature, 'base64');
    return await crypto.subtle.verify('Ed25519', publicKey, sigBuffer, data);
  }

  /**
   * Verify registry signature
   */
  private async verifyRegistrySignature(
    registryJson: string,
    signature: RegistrySignature
  ): Promise<boolean> {
    if (this.publicKeys.length === 0) {
      // No public keys configured - skip verification (dev mode)
      return true;
    }

    // Try each public key
    for (const pubkeyBase64 of this.publicKeys) {
      try {
        const publicKey = await this.importPublicKey(pubkeyBase64);
        const isValid = await this.verifySignature(registryJson, signature, publicKey);
        if (isValid) {
          return true;
        }
      } catch {
        // Try next key
        continue;
      }
    }

    return false;
  }

  /**
   * Fetch registry and signature from network
   */
  private async fetchFromNetwork(): Promise<{
    registry: WalletRegistryV1;
    signature: RegistrySignature;
    etag?: string;
  }> {
    const registryUrl = this.getRegistryUrl();
    const sigUrl = this.getSignatureUrl();
    const requireSignature = this.publicKeys.length > 0;

    // AbortController for fetch timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

    try {
    // Fetch registry (always required)
    const registryResponse = await this.fetchFn(registryUrl, {
      headers: {
        'Accept': 'application/json',
        'If-None-Match': this.memoryCache.lastKnownGood?.etag || '',
      },
      signal: controller.signal,
    });

    // Handle 304 Not Modified
    if (registryResponse.status === 304) {
      if (this.memoryCache.lastKnownGood) {
        // For 304, we still need a signature object for return type
        // In dev mode, create dummy signature (skip fetch entirely)
        let signature: RegistrySignature;
        if (requireSignature) {
          // Production mode: try to fetch signature
          try {
            const sigResponse = await this.fetchFn(sigUrl, {
              headers: { 'Accept': 'application/json' },
              signal: controller.signal,
            });
            if (sigResponse.ok) {
              signature = JSON.parse(await sigResponse.text()) as RegistrySignature;
            } else {
              // Signature missing but we have cache - use dummy
              signature = { algorithm: 'ed25519', signature: '', keyFingerprint: '', signedAt: new Date().toISOString() };
            }
          } catch {
            signature = { algorithm: 'ed25519', signature: '', keyFingerprint: '', signedAt: new Date().toISOString() };
          }
        } else {
          // Dev mode: create dummy signature
          signature = { algorithm: 'ed25519', signature: '', keyFingerprint: '', signedAt: new Date().toISOString() };
        }
        
        return {
          registry: this.memoryCache.lastKnownGood.registry,
          signature,
          etag: this.memoryCache.lastKnownGood.etag,
        };
      }
    }

    if (!registryResponse.ok) {
      throw new RegistryFetchFailedError(
        registryUrl,
        new Error(`${registryResponse.status} ${registryResponse.statusText}`)
      );
    }

    const registryJson = await registryResponse.text();
    const registry = JSON.parse(registryJson) as WalletRegistryV1;
    const etag = registryResponse.headers.get('ETag') || undefined;

    // Validate schema
    if (!validateRegistry(registry)) {
      throw new RegistrySchemaInvalidError(
        'Invalid registry schema',
        { url: registryUrl }
      );
    }

    // Fetch signature (skip entirely in dev mode when no public keys)
    let signature: RegistrySignature;
    
    if (requireSignature) {
      // Public keys configured - signature is required
      const sigResponse = await this.fetchFn(sigUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!sigResponse.ok) {
        throw new RegistryFetchFailedError(
          sigUrl,
          new Error(`${sigResponse.status} ${sigResponse.statusText}`)
        );
      }
      signature = JSON.parse(await sigResponse.text()) as RegistrySignature;
      
      // Verify signature
      const verified = await this.verifyRegistrySignature(registryJson, signature);
      if (!verified) {
        throw new RegistryVerificationFailedError(
          'Signature verification failed',
          { url: registryUrl }
        );
      }
    } else {
      // Dev mode: skip signature fetch entirely, create dummy signature
      console.log('[RegistryClient] Dev mode: skipping signature fetch (no public keys configured)');
      signature = { algorithm: 'ed25519', signature: '', keyFingerprint: '', signedAt: new Date().toISOString() };
    }

    // Check sequence number (prevent downgrades)
    if (this.memoryCache.lastKnownGood) {
      if (registry.metadata.sequence < this.memoryCache.lastKnownGood.sequence) {
        throw new RegistryVerificationFailedError(
          `Sequence downgrade detected: ${registry.metadata.sequence} < ${this.memoryCache.lastKnownGood.sequence}`,
          { url: registryUrl }
        );
      }
    }

    return { registry, signature, etag };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get registry with SWR pattern
   * - Returns cached immediately if available
   * - Refreshes in background
   */
  async getRegistry(): Promise<WalletRegistryV1> {
    // Return cached immediately if available
    if (this.memoryCache.lastKnownGood) {
      const now = Date.now();
      const age = now - this.memoryCache.lastKnownGood.fetchedAt;

      // If cache is fresh, return it
      if (age < this.cacheTtl) {
        // Trigger background refresh if not already refreshing
        if (!this.memoryCache.refreshPromise) {
          this.memoryCache.refreshPromise = this.refreshRegistry();
        }
        return this.memoryCache.lastKnownGood.registry;
      }

      // Cache is stale but usable
      if (age < this.staleTtl) {
        // Trigger refresh
        if (!this.memoryCache.refreshPromise) {
          this.memoryCache.refreshPromise = this.refreshRegistry();
        }
        return this.memoryCache.lastKnownGood.registry;
      }
    }

    // No cache or too stale - fetch synchronously
    return await this.refreshRegistry();
  }

  /**
   * Refresh registry from network
   */
  private async refreshRegistry(): Promise<WalletRegistryV1> {
    // If already refreshing, wait for that
    if (this.memoryCache.refreshPromise) {
      return await this.memoryCache.refreshPromise;
    }

    const refreshPromise = (async () => {
      try {
        const { registry, etag } = await this.fetchFromNetwork();

        console.log('[RegistryClient] Successfully fetched registry:', {
          channel: registry.metadata.channel,
          sequence: registry.metadata.sequence,
          walletCount: registry.wallets.length,
        });

        // Update cache
        const cached: CachedRegistry = {
          registry,
          verified: true,
          fetchedAt: Date.now(),
          etag,
          sequence: registry.metadata.sequence,
        };

        this.memoryCache.lastKnownGood = cached;
        this.memoryCache.lastAttempt = {
          fetchedAt: Date.now(),
        };

        // Update status
        this.updateStatus({
          source: 'network',
          verified: true,
          channel: registry.metadata.channel,
          sequence: registry.metadata.sequence,
          stale: false,
          fetchedAt: cached.fetchedAt,
          etag,
        });

        // Persist to storage
        if (this.storage) {
          await this.saveToStorage(cached);
        }

        return registry;
      } catch (error) {
        // Update last attempt
        this.memoryCache.lastAttempt = {
          fetchedAt: Date.now(),
          errorCode:
            error instanceof RegistryFetchFailedError
              ? 'REGISTRY_FETCH_FAILED'
              : error instanceof RegistryVerificationFailedError
                ? 'REGISTRY_VERIFICATION_FAILED'
                : error instanceof RegistrySchemaInvalidError
                  ? 'REGISTRY_SCHEMA_INVALID'
                  : 'UNKNOWN',
        };

        // Update status with error
        const lastKnownGood = this.memoryCache.lastKnownGood;
        if (lastKnownGood) {
          const cantonError = error instanceof RegistryFetchFailedError ||
            error instanceof RegistryVerificationFailedError ||
            error instanceof RegistrySchemaInvalidError
            ? error
            : undefined;
          this.updateStatus({
            source: 'cache',
            verified: lastKnownGood.verified,
            channel: lastKnownGood.registry.metadata.channel,
            sequence: lastKnownGood.sequence,
            stale: Date.now() - lastKnownGood.fetchedAt > this.cacheTtl,
            fetchedAt: lastKnownGood.fetchedAt,
            etag: lastKnownGood.etag,
            error: cantonError,
          });

          // Return last known good
          return lastKnownGood.registry;
        }

        // No cache available - rethrow
        throw error;
      } finally {
        this.memoryCache.refreshPromise = null;
      }
    })();

    this.memoryCache.refreshPromise = refreshPromise;
    return await refreshPromise;
  }

  /**
   * Update registry status
   */
  private updateStatus(status: RegistryStatus): void {
    this.currentStatus = status;
  }

  /**
   * Get current registry status
   */
  getStatus(): RegistryStatus | null {
    if (!this.memoryCache.lastKnownGood) {
      return null;
    }

    const now = Date.now();
    const age = now - this.memoryCache.lastKnownGood.fetchedAt;

    return {
      source: this.currentStatus?.source || 'cache',
      verified: this.memoryCache.lastKnownGood.verified,
      channel: this.memoryCache.lastKnownGood.registry.metadata.channel,
      sequence: this.memoryCache.lastKnownGood.sequence,
      stale: age > this.cacheTtl,
      fetchedAt: this.memoryCache.lastKnownGood.fetchedAt,
      etag: this.memoryCache.lastKnownGood.etag,
      error: this.currentStatus?.error,
    };
  }

  /**
   * Save to persistent storage
   */
  private async saveToStorage(cached: CachedRegistry): Promise<void> {
    if (!this.storage) return;

    const key = `registry_${this.channel}`;
    const value = JSON.stringify(cached);
    await this.storage.set(key, value);
  }

  /**
   * Load from persistent storage
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.storage) return;

    const key = `registry_${this.channel}`;
    const value = await this.storage.get(key);
    if (value) {
      try {
        const cached = JSON.parse(value) as CachedRegistry;
        this.memoryCache.lastKnownGood = cached;
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Get all wallets
   */
  async getWallets(): Promise<WalletInfo[]> {
    const registry = await this.getRegistry();
    return registry.wallets.map((entry) =>
      registryEntryToWalletInfo(entry, registry.metadata.channel)
    );
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<WalletInfo> {
    const registry = await this.getRegistry();
    const entry = registry.wallets.find((w) => w.id === walletId);

    if (!entry) {
      throw new WalletNotFoundError(walletId);
    }

    return registryEntryToWalletInfo(entry, registry.metadata.channel);
  }

  /**
   * Get wallet entry (includes adapter config)
   */
  async getWalletEntry(walletId: string): Promise<RegistryWalletEntry> {
    const registry = await this.getRegistry();
    const entry = registry.wallets.find((w) => w.id === walletId);

    if (!entry) {
      throw new WalletNotFoundError(walletId);
    }

    if (!validateWalletEntry(entry)) {
      throw new RegistrySchemaInvalidError(
        `Invalid wallet entry for ${walletId}`,
        { url: this.getRegistryUrl() }
      );
    }

    return entry;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.memoryCache.lastKnownGood = null;
    this.memoryCache.lastAttempt = null;
    this.memoryCache.refreshPromise = null;
    this.currentStatus = null;

    if (this.storage) {
      this.storage.remove(`registry_${this.channel}`).catch(() => {
        // Ignore errors
      });
    }
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    if (!this.enableCache || !this.memoryCache.lastKnownGood) {
      return false;
    }

    const now = Date.now();
    return now - this.memoryCache.lastKnownGood.fetchedAt < this.cacheTtl;
  }
}
