/**
 * Signature integrity tests.
 *
 * Every test here asserts an OUTCOME (what the client returned, what it threw,
 * what it reported through `getStatus()`), never that a dependency was called.
 * A test that checks the signature endpoint "was fetched" passes whether the
 * answer was verified, fabricated or ignored, which is exactly the class of
 * check that let the defects below survive.
 *
 * Each case in this file fails against the code as it was before this change:
 *
 *   304 while a signature is required  -> was returned as verified, unchecked
 *   .sig missing (404)                 -> was reported as success with a
 *                                         fabricated empty signature object
 *   .sig unreachable (5xx)             -> same fabrication
 *   signature does not verify          -> was swallowed by the cache fallback
 *   stale .sig vs fresh manifest       -> was indistinguishable from tampering
 *   dev mode (no keys configured)      -> reported verified: true having
 *                                         checked nothing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { RegistryClient } from './client';
import type { WalletRegistryV1 } from './schema';
import {
  RegistryVerificationFailedError,
  RegistrySignatureMissingError,
  RegistryFetchFailedError,
} from '@partylayer/core';

const crypto = webcrypto as unknown as Crypto;

/**
 * Older than the default staleTtl (24h), so `getRegistry()` takes the
 * synchronous network path instead of returning the seeded cache and
 * refreshing in the background. Without this a test can assert against the
 * seed it planted and never reach the code it names.
 */
const STALE = Date.now() - 25 * 60 * 60 * 1000;

function makeRegistry(sequence = 1): WalletRegistryV1 {
  return {
    metadata: {
      registryVersion: '1.0.0',
      schemaVersion: '1.0.0',
      publishedAt: '2026-01-01T00:00:00Z',
      channel: 'stable',
      sequence,
    },
    wallets: [],
  } as unknown as WalletRegistryV1;
}

/** A real Ed25519 pair, so the verified path is genuinely exercised. */
async function makeKeypair() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519', namedCurve: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  return { pair, publicKeyBase64: Buffer.from(raw).toString('base64') };
}

async function signBytes(privateKey: CryptoKey, json: string) {
  const sig = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(json));
  return {
    algorithm: 'ed25519' as const,
    signature: Buffer.from(sig).toString('base64'),
    keyFingerprint: 'test',
    signedAt: '2026-01-01T00:00:00Z',
  };
}

interface Routes {
  manifest: () => Response;
  signature?: () => Response;
}

/** Minimal router so each test states exactly what the network does. */
function router(routes: Routes): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/registry.json')) return routes.manifest();
    if (url.endsWith('/registry.sig')) {
      if (!routes.signature) throw new Error('network down');
      return routes.signature();
    }
    throw new Error(`unexpected url ${url}`);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ETag: '"v1"' },
    ...init,
  });
}

function makeClient(fetchFn: typeof fetch, publicKeys: string[]) {
  return new RegistryClient({
    registryUrl: 'https://registry.test',
    channel: 'stable',
    registryPublicKeys: publicKeys,
    fetch: fetchFn,
  });
}

describe('signature integrity', () => {
  let keys: Awaited<ReturnType<typeof makeKeypair>>;

  beforeEach(async () => {
    keys = await makeKeypair();
  });

  describe('a 304 must not shortcut verification', () => {
    it('reuses a cached entry only when that entry was itself verified', async () => {
      const registry = makeRegistry(5);
      const client = makeClient(
        router({ manifest: () => new Response(null, { status: 304 }) }),
        [keys.publicKeyBase64],
      );
      // Seed a cache entry that WAS verified when stored.
      (client as unknown as { memoryCache: Record<string, unknown> }).memoryCache.lastKnownGood = {
        registry,
        verified: true,
        fetchedAt: STALE,
        etag: '"v1"',
        sequence: 5,
      };

      const result = await client.getRegistry();
      expect(result.metadata.sequence).toBe(5);
      expect(client.getStatus()?.verified).toBe(true);
    });

    it('does not report an UNVERIFIED cached entry as verified', async () => {
      // The bypass: previously a 304 returned the cached registry and reported
      // success regardless of whether anything had ever been checked. Here the
      // cached entry is unverified, so the client must not send a validator,
      // must fetch the full body, and must verify it.
      const registry = makeRegistry(5);
      const json = JSON.stringify(registry);
      let sentIfNoneMatch: string | null = null;

      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/registry.json')) {
          const headers = new Headers(init?.headers);
          sentIfNoneMatch = headers.get('If-None-Match');
          return new Response(json, {
            status: 200,
            headers: { 'Content-Type': 'application/json', ETag: '"v1"' },
          });
        }
        return jsonResponse(await signBytes(keys.pair.privateKey, json));
      }) as unknown as typeof fetch;

      const client = makeClient(fetchFn, [keys.publicKeyBase64]);
      (client as unknown as { memoryCache: Record<string, unknown> }).memoryCache.lastKnownGood = {
        registry,
        verified: false,
        fetchedAt: STALE,
        etag: '"v1"',
        sequence: 5,
      };

      await client.getRegistry();
      // The outcome that matters: no validator was offered for an entry we
      // could not legitimately reuse, so the server could not answer 304.
      expect(sentIfNoneMatch).toBeNull();
      expect(client.getStatus()?.verified).toBe(true);
    });
  });

  describe('a missing signature is distinct from an outage', () => {
    it('throws RegistrySignatureMissingError on 404 with no verified cache', async () => {
      const registry = makeRegistry(1);
      const client = makeClient(
        router({
          manifest: () => jsonResponse(registry),
          signature: () => new Response('not found', { status: 404 }),
        }),
        [keys.publicKeyBase64],
      );
      await expect(client.getRegistry()).rejects.toBeInstanceOf(RegistrySignatureMissingError);
    });

    it('throws RegistryFetchFailedError, not the missing error, when the endpoint fails', async () => {
      const registry = makeRegistry(1);
      const client = makeClient(
        router({
          manifest: () => jsonResponse(registry),
          signature: () => new Response('boom', { status: 503 }),
        }),
        [keys.publicKeyBase64],
      );
      const err = await client.getRegistry().catch((e) => e);
      expect(err).toBeInstanceOf(RegistryFetchFailedError);
      expect(err).not.toBeInstanceOf(RegistrySignatureMissingError);
    });

    it('keeps serving a previously verified cache instead of going dark', async () => {
      // The behaviour that stops the first CDN blip after enabling signing from
      // taking wallet discovery down for everyone.
      const registry = makeRegistry(7);
      const client = makeClient(
        router({
          manifest: () => jsonResponse(makeRegistry(7)),
          signature: () => new Response('gone', { status: 503 }),
        }),
        [keys.publicKeyBase64],
      );
      (client as unknown as { memoryCache: Record<string, unknown> }).memoryCache.lastKnownGood = {
        registry,
        verified: true,
        fetchedAt: STALE,
        etag: '"old"',
        sequence: 7,
      };

      const result = await client.getRegistry();
      expect(result.metadata.sequence).toBe(7);
      expect(client.getStatus()?.source).toBe('cache');
    });
  });

  describe('an invalid signature is fatal and loud', () => {
    it('throws rather than silently falling back to cache', async () => {
      const registry = makeRegistry(9);
      const other = await makeKeypair();
      const json = JSON.stringify(registry);

      const client = makeClient(
        router({
          manifest: () => jsonResponse(registry),
          // Signed by a key the client does not trust.
          signature: () => jsonResponse({ algorithm: 'ed25519', signature: 'AAAA', keyFingerprint: 'x', signedAt: 'now' }),
        }),
        [other.publicKeyBase64],
      );
      (client as unknown as { memoryCache: Record<string, unknown> }).memoryCache.lastKnownGood = {
        registry,
        verified: true,
        fetchedAt: STALE,
        etag: '"old"',
        sequence: 9,
      };

      // A cache exists and is verified, and it still must not be used to paper
      // over bytes that failed verification.
      await expect(client.getRegistry()).rejects.toBeInstanceOf(RegistryVerificationFailedError);
      void json;
    });

    it('treats a stale signature against a fresh manifest as a verification failure', async () => {
      // The cache-skew case: both endpoints answer, both are well formed, and
      // the signature is over DIFFERENT bytes than the manifest served.
      const stale = makeRegistry(1);
      const fresh = makeRegistry(2);
      const staleSig = await signBytes(keys.pair.privateKey, JSON.stringify(stale));

      const client = makeClient(
        router({
          manifest: () => jsonResponse(fresh),
          signature: () => jsonResponse(staleSig),
        }),
        [keys.publicKeyBase64],
      );
      await expect(client.getRegistry()).rejects.toBeInstanceOf(RegistryVerificationFailedError);
    });

    it('a 304 cannot let a stale signature stand in for verification', async () => {
      // This is where the cache-skew defect actually lived. The manifest and
      // the signature were served with different max-age values, and the old
      // code sent If-None-Match unconditionally: on 304 it returned the cached
      // manifest, fetched whatever signature happened to be current, and
      // reported success without ever checking one against the other.
      //
      // Now an unverified cache entry is not offered as a validator, so the
      // server returns the full body, and the signature is checked against the
      // bytes this call actually received. A stale signature is caught.
      const stale = makeRegistry(1);
      const fresh = makeRegistry(2);
      const staleSig = await signBytes(keys.pair.privateKey, JSON.stringify(stale));

      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/registry.json')) {
          const sent = new Headers(init?.headers).get('If-None-Match');
          // A real cache answers 304 only when given a matching validator.
          if (sent === '\"v1\"') return new Response(null, { status: 304 });
          return new Response(JSON.stringify(fresh), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ETag: '\"v2\"' },
          });
        }
        return jsonResponse(staleSig);
      }) as unknown as typeof fetch;

      const client = makeClient(fetchFn, [keys.publicKeyBase64]);
      (client as unknown as { memoryCache: Record<string, unknown> }).memoryCache.lastKnownGood = {
        registry: stale,
        verified: false,
        fetchedAt: STALE,
        etag: '\"v1\"',
        sequence: 1,
      };

      await expect(client.getRegistry()).rejects.toBeInstanceOf(RegistryVerificationFailedError);
    });

    it('accepts the matching pair fetched together', async () => {
      const registry = makeRegistry(3);
      const json = JSON.stringify(registry);
      const sig = await signBytes(keys.pair.privateKey, json);

      const client = makeClient(
        (async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.endsWith('/registry.json')) {
            return new Response(json, {
              status: 200,
              headers: { 'Content-Type': 'application/json', ETag: '"v3"' },
            });
          }
          return jsonResponse(sig);
        }) as unknown as typeof fetch,
        [keys.publicKeyBase64],
      );

      const result = await client.getRegistry();
      expect(result.metadata.sequence).toBe(3);
      expect(client.getStatus()?.verified).toBe(true);
    });
  });

  describe('dev mode reports what it actually did', () => {
    it('reports verified: false when no public keys are configured', async () => {
      // Previously hardcoded true, so a consumer reading status.verified (which
      // our own docs tell them to read) was told the registry was verified when
      // nothing had been checked and the .sig was never even requested.
      const registry = makeRegistry(1);
      let signatureRequested = false;
      const client = makeClient(
        (async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.endsWith('/registry.sig')) {
            signatureRequested = true;
            return new Response('nope', { status: 404 });
          }
          return jsonResponse(registry);
        }) as unknown as typeof fetch,
        [],
      );

      const result = await client.getRegistry();
      expect(result.metadata.sequence).toBe(1);
      expect(client.getStatus()?.verified).toBe(false);
      expect(signatureRequested).toBe(false);
    });
  });
});
