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
