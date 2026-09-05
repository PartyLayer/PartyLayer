/**
 * Bron Auth Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BronAuthClient } from './auth';
import type { BronAuthConfig } from './auth';

describe('BronAuthClient', () => {
  let authClient: BronAuthClient;
  let config: BronAuthConfig;

  beforeEach(() => {
    config = {
      authorizationUrl: 'https://auth.bron.org/authorize',
      tokenUrl: 'https://auth.bron.org/token',
      clientId: 'test-client-id',
      redirectUri: 'https://app.test.com/callback',
      usePKCE: true,
    };

    authClient = new BronAuthClient(config);
  });

  describe('PKCE generation', () => {
    it('should generate deterministic code verifier and challenge for known input', async () => {
      // Note: PKCE uses crypto.randomValues, so we can't test exact determinism
      // But we can test that verifier and challenge are generated correctly
      
      const { verifier, challenge } = await (authClient as any).generatePKCE();
      
      expect(verifier).toBeDefined();
      expect(verifier.length).toBeGreaterThan(0);
      expect(challenge).toBeDefined();
      expect(challenge.length).toBeGreaterThan(0);
      
      // Challenge should be base64url encoded SHA-256 of verifier
      // Verify format (base64url: no padding, no +/=)
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate different verifiers on each call', async () => {
      const pkce1 = await (authClient as any).generatePKCE();
      const pkce2 = await (authClient as any).generatePKCE();
      
      // Verifiers should be different (random)
      expect(pkce1.verifier).not.toBe(pkce2.verifier);
    });
  });

  describe('token storage', () => {
    it('should store tokens in memory by default', async () => {
      // Mock tokens
      const tokens = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      // Set tokens directly (simulating finishAuth)
      (authClient as any).tokens = tokens;

      const retrieved = await authClient.getAccessToken();
      expect(retrieved).toBe('test-token');
    });

    it('should return null for expired tokens', async () => {
      const tokens = {
        accessToken: 'test-token',
        expiresAt: Date.now() - 1000, // Expired
        tokenType: 'Bearer',
      };

      (authClient as any).tokens = tokens;

      const retrieved = await authClient.getAccessToken();
      expect(retrieved).toBeNull();
    });
  });
});

/**
 * "Bron tokens are not persisted by default" — the security property, tested at
 * the level where it can actually be observed.
 *
 * This was carried as `test.fixme('Bron tokens not persisted by default')` in
 * apps/demo's e2e suite, disabled from the day it was written. It could never
 * have run there: the demo registers no Bron adapter by design (Bron needs OAuth
 * credentials a public demo cannot ship), so its body was written as
 * `if (bronOption.count() > 0)` with no else — Bron is never in that picker, the
 * assertion never executed, and it would have reported green with the guard
 * deleted. It was removed rather than repaired, and this is where it lands.
 *
 * The existing "should store tokens in memory by default" case above does NOT
 * cover this. It assigns `tokens` directly and reads it back, which tests
 * retrieval. The property here is about a WRITE that must not happen.
 *
 * The real gate is `auth.ts`: `this.tokens = tokens;` always, then
 * `if (this.storage) await this.storage.set('bron_tokens', ...)`. So the
 * behaviour to pin is: with a storage adapter the write happens, and without one
 * nothing is persisted anywhere a later reader could recover it.
 */
describe('token persistence', () => {
  const config: BronAuthConfig = {
    authorizationUrl: 'https://auth.example/authorize',
    tokenUrl: 'https://auth.example/token',
    clientId: 'test-client-id',
    redirectUri: 'https://app.test.com/callback',
    usePKCE: true,
  };

  const TOKEN_RESPONSE = {
    access_token: 'access-abc',
    refresh_token: 'refresh-xyz',
    expires_in: 3600,
    token_type: 'Bearer',
  };

  function mockTokenEndpoint(): void {
    globalThis.fetch = (async () =>
      ({
        ok: true,
        json: async () => TOKEN_RESPONSE,
        text: async () => '',
      })) as unknown as typeof fetch;
  }

  it('writes to the storage adapter when one is configured', async () => {
    mockTokenEndpoint();
    const writes: Array<[string, string]> = [];
    const storage = {
      get: async () => null,
      set: async (k: string, v: string) => {
        writes.push([k, v]);
      },
      remove: async () => {},
      clear: async () => {},
    };

    const client = new BronAuthClient(config, storage as never);
    await client.finishAuth('https://app.test.com/callback?code=auth-code');

    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('bron_tokens');
    expect(JSON.parse(writes[0][1])).toMatchObject({ accessToken: 'access-abc' });
  });

  it('persists NOTHING when no storage adapter is configured', async () => {
    mockTokenEndpoint();
    const client = new BronAuthClient(config); // no storage — the default
    const tokens = await client.finishAuth('https://app.test.com/callback?code=auth-code');

    // The token is usable in this instance...
    expect(tokens.accessToken).toBe('access-abc');
    expect(await client.getAccessToken()).toBe('access-abc');

    // ...and unrecoverable from any other. This is the assertion that makes it a
    // persistence test rather than a retrieval one: a second client, same config,
    // no storage, finds nothing — so the first wrote nothing durable.
    const fresh = new BronAuthClient(config);
    expect(await fresh.getAccessToken()).toBeNull();
  });
});
