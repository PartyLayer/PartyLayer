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
  RegistrySignatureMissingError,
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
 * What the client established about the manifest's signature on this fetch.
 *
 * A discriminated union rather than a boolean, deliberately. `verified` and
 * `reused-verified` are the only variants that mean "checked against a key",
 * and neither is constructible without having done the check: the code cannot
 * express success it did not earn. The previous shape was a
 * `RegistrySignature` object that failure paths filled with empty strings and
 * returned alongside a hardcoded `verified: true`.
 */
export type SignatureOutcome =
  /** Bytes from this fetch were checked against a configured key and matched. */
  | { kind: 'verified'; signature: RegistrySignature }
  /** 304: the served bytes are the ones we already verified and cached. */
  | { kind: 'reused-verified' }
  /** No public keys configured, so nothing was checked. Not a success. */
  | { kind: 'not-required' }
  /** The endpoint answered and said no signature is published (404/410). */
  | { kind: 'missing'; url: string }
  /** The endpoint could not be reached or failed. An outage, not a verdict. */
  | { kind: 'unavailable'; url: string; cause: unknown };

/** One construction site for the unavailable variant, rather than three. */
function unavailable(url: string, cause: unknown): SignatureOutcome {
  return { kind: 'unavailable', url, cause };
}

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
   * Fetch the manifest and its signature AS A UNIT, and verify the signature
   * against the exact bytes this call received.
   *
   * Three things this shape is for, each of which was a real defect:
   *
   *  - The signature covers the exact UTF-8 bytes of registry.json. Fetching
   *    the two independently let a client pair a fresh manifest with a stale
   *    signature and fail verification on a correctly signed pair. The CDN
   *    served them with different max-age values, so the window was real, not
   *    theoretical. Verifying what THIS call fetched removes the class of bug
   *    rather than the instance: a future cache-header change cannot bring it
   *    back.
   *
   *  - A 304 no longer shortcuts verification. See `canReuseCached`.
   *
   *  - There is no way to report a signature without having one. The result
   *    carries a `SignatureOutcome`, whose `verified` variant is only
   *    constructible after `verifyRegistrySignature` has actually returned
   *    true. The old code fabricated `{ signature: '', keyFingerprint: '' }`
   *    on the failure paths and returned it as though nothing was wrong.
   */
  private async fetchFromNetwork(): Promise<{
    registry: WalletRegistryV1;
    outcome: SignatureOutcome;
    etag?: string;
  }> {
    const registryUrl = this.getRegistryUrl();
    const sigUrl = this.getSignatureUrl();
    const requireSignature = this.publicKeys.length > 0;

    // AbortController for fetch timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeout);

    try {
      const cached = this.memoryCache.lastKnownGood;

      // WHAT A 304 MEANS WHEN A SIGNATURE IS REQUIRED.
      //
      // 304 says only that the manifest bytes are unchanged from the ones our
      // ETag names. That is enough to reuse a cached entry we ALREADY verified,
      // because the bytes we verified are the bytes still being served. It is
      // not enough to call an unverified entry verified: nothing has been
      // checked against a key.
      //
      // So we only offer If-None-Match when the entry it would revalidate is
      // one we could legitimately reuse. When signatures are required and the
      // cached entry is unverified, we deliberately ask for the full body so
      // there is something to verify. Cheaper than the alternative, which is
      // reporting success we did not earn.
      const canReuseCached = cached !== null && (!requireSignature || cached.verified);

      const registryResponse = await this.fetchFn(registryUrl, {
        headers: {
          Accept: 'application/json',
          ...(canReuseCached && cached?.etag ? { 'If-None-Match': cached.etag } : {}),
        },
        signal: controller.signal,
      });

      if (registryResponse.status === 304) {
        // Only reachable when we sent If-None-Match, which we only do when the
        // cached entry is reusable. Assert rather than assume: a proxy that
        // answers 304 to a request without a validator would otherwise hand us
        // an unverified entry to report as verified.
        if (!canReuseCached || !cached) {
          throw new RegistryFetchFailedError(
            registryUrl,
            new Error('304 without a usable validator'),
          );
        }
        return {
          registry: cached.registry,
          outcome: cached.verified
            ? { kind: 'reused-verified' }
            : { kind: 'not-required' },
          etag: cached.etag,
        };
      }

      if (!registryResponse.ok) {
        throw new RegistryFetchFailedError(
          registryUrl,
          new Error(`${registryResponse.status} ${registryResponse.statusText}`),
        );
      }

      const registryJson = await registryResponse.text();
      const registry = JSON.parse(registryJson) as WalletRegistryV1;
      const etag = registryResponse.headers.get('ETag') || undefined;

      if (!validateRegistry(registry)) {
        throw new RegistrySchemaInvalidError('Invalid registry schema', { url: registryUrl });
      }

      // Sequence check before verification: a downgrade is a downgrade whether
      // or not the bytes are signed, and it is cheaper to detect.
      if (this.memoryCache.lastKnownGood) {
        if (registry.metadata.sequence < this.memoryCache.lastKnownGood.sequence) {
          throw new RegistryVerificationFailedError(
            `Sequence downgrade detected: ${registry.metadata.sequence} < ${this.memoryCache.lastKnownGood.sequence}`,
            { url: registryUrl },
          );
        }
      }

      const outcome = await this.establishSignature(registryJson, sigUrl, requireSignature, controller);
      return { registry, outcome, etag };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Resolve the signature for bytes we just fetched.
   *
   * Separates three outcomes the old code collapsed into one:
   *
   *   missing      the endpoint answered and said it is not there (404/410).
   *                A deployment state: signing not published for this channel.
   *   unavailable  the endpoint could not be reached, or failed (5xx, network,
   *                timeout). An outage, and the caller may fall back to a
   *                previously verified cache rather than going dark.
   *   verified     bytes checked against a configured key and matched.
   *
   * A signature that is present and does NOT verify is not an outcome at all:
   * it throws, and it keeps throwing all the way out. That is the one case
   * signature checking exists to catch.
   */
  private async establishSignature(
    registryJson: string,
    sigUrl: string,
    requireSignature: boolean,
    controller: AbortController,
  ): Promise<SignatureOutcome> {
    if (!requireSignature) {
      // No keys configured, so nothing was checked. Reported honestly rather
      // than as success; `status.verified` is false in this mode.
      return { kind: 'not-required' };
    }

    let sigResponse: Response;
    try {
      sigResponse = await this.fetchFn(sigUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (cause) {
      return unavailable(sigUrl, cause);
    }

    if (sigResponse.status === 404 || sigResponse.status === 410) {
      return { kind: 'missing', url: sigUrl };
    }
    if (!sigResponse.ok) {
      return unavailable(sigUrl, new Error(`${sigResponse.status} ${sigResponse.statusText}`));
    }

    let signature: RegistrySignature;
    try {
      signature = JSON.parse(await sigResponse.text()) as RegistrySignature;
    } catch (cause) {
      return unavailable(sigUrl, cause);
    }

    const verified = await this.verifyRegistrySignature(registryJson, signature);
    if (!verified) {
      throw new RegistryVerificationFailedError('Signature verification failed', {
        url: sigUrl,
      });
    }
    return { kind: 'verified', signature };
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
        const { registry, outcome, etag } = await this.fetchFromNetwork();
        const requireSignature = this.publicKeys.length > 0;

        // A signature that is required but absent, or that could not be
        // fetched, is not a reason to report success. It is also not a reason
        // to go dark: if we hold an entry we previously verified, the caller
        // keeps working on it and the error surfaces through status. Only when
        // there is nothing verified to fall back on does this throw, and it
        // throws a DIFFERENT error for "not published" than for "unreachable"
        // so an operator can tell a deployment gap from an outage.
        if (requireSignature && (outcome.kind === 'missing' || outcome.kind === 'unavailable')) {
          const usable = this.memoryCache.lastKnownGood;
          if (usable && usable.verified) {
            this.updateStatus({
              source: 'cache',
              verified: true,
              channel: usable.registry.metadata.channel,
              sequence: usable.sequence,
              stale: Date.now() - usable.fetchedAt > this.cacheTtl,
              fetchedAt: usable.fetchedAt,
              etag: usable.etag,
            });
            return usable.registry;
          }
          throw outcome.kind === 'missing'
            ? new RegistrySignatureMissingError(outcome.url)
            : new RegistryFetchFailedError(outcome.url, outcome.cause);
        }

        // Truthful, not hardcoded. In dev mode (no keys configured) this is
        // false, because nothing was checked, and `status.verified` says so.
        // Both variants mean a signature was checked against a key: one on
        // this fetch, one when the reused entry was stored.
        const verified = outcome.kind === 'verified' || outcome.kind === 'reused-verified';

        // Update cache
        const cached: CachedRegistry = {
          registry,
          verified,
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
          verified,
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
            error instanceof RegistrySignatureMissingError
              ? 'REGISTRY_SIGNATURE_MISSING'
              : error instanceof RegistryFetchFailedError
              ? 'REGISTRY_FETCH_FAILED'
              : error instanceof RegistryVerificationFailedError
                ? 'REGISTRY_VERIFICATION_FAILED'
                : error instanceof RegistrySchemaInvalidError
                  ? 'REGISTRY_SCHEMA_INVALID'
                  : 'UNKNOWN',
        };

        // A FAILED VERIFICATION IS NEVER SWALLOWED.
        //
        // Every other failure here may fall back to the last known good entry,
        // because an outage should not take wallet discovery down. This one may
        // not: bytes were served that do not match the key, which is precisely
        // what signature checking exists to detect. Falling back would leave the
        // app working, the operator uninformed, and the tampering undetected,
        // which is the same as not checking at all. It propagates.
        if (error instanceof RegistryVerificationFailedError) {
          const lkg = this.memoryCache.lastKnownGood;
          if (lkg) {
            this.updateStatus({
              source: 'cache',
              verified: lkg.verified,
              channel: lkg.registry.metadata.channel,
              sequence: lkg.sequence,
              stale: Date.now() - lkg.fetchedAt > this.cacheTtl,
              fetchedAt: lkg.fetchedAt,
              etag: lkg.etag,
              error,
            });
          }
          throw error;
        }

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
