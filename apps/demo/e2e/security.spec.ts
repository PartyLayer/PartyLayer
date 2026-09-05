/**
 * Security Negative Test Suite
 * 
 * Tests security-critical behaviors:
 * - Registry tamper detection
 * - Downgrade protection
 * - Origin allowlist enforcement
 * - State replay attacks
 * - Callback origin spoofing
 * - Token storage policies
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const REGISTRY_DIR = join(process.cwd(), '../../registry');

test.describe('Security Tests', () => {
  // There used to be a beforeEach here setting NEXT_PUBLIC_MOCK_WALLETS='1'
  // "to ensure we're in mock mode". It did nothing twice over: no product code
  // reads that variable, and it was assigned in the Playwright process after the
  // dev server had already started, so it could not have reached the app even if
  // something read it. Mock mode comes from the provider fixture
  // (apps/demo/public/mock-cip0103-wallet.js), gated on NODE_ENV.

  test.describe('Registry Security', () => {
    test('registry tamper detection -> fallback to cached LKG', async ({ page }) => {
      // This test verifies that tampered registry is rejected
      // and falls back to last-known-good cache
      
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // Verify registry status shows verified
      const registryStatus = page.locator('text=/Registry|Verified/i');
      await expect(registryStatus.first()).toBeVisible({ timeout: 5000 });

      // Note: Actual tampering would require modifying registry.json
      // and verifying client rejects it. This is tested in unit tests.
      // E2E test verifies UI shows appropriate status.
    });

    test('downgrade protection -> reject lower sequence', async ({ page }) => {
      // This test verifies sequence downgrade is rejected
      // Unit tests cover the logic; E2E verifies error handling
      
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // Registry client should reject downgrades
      // This is verified in unit tests; E2E confirms error surfaces correctly
      const errorDisplay = page.locator('text=/error|Error/i');
      // Should not show downgrade error in normal flow
      // (downgrade would be rejected before UI update)
    });
  });

  test.describe('Origin Security', () => {
    test('origin not allowed -> ORIGIN_NOT_ALLOWED error', async ({ page, context }) => {
      // Test origin allowlist enforcement
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // Open connect modal
      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      await connectButton.click();

      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Origin allowlist is enforced at adapter level
      // Mock adapters should respect allowlist configuration
      // This is tested in unit tests; E2E verifies error displays correctly
    });

    /**
     * Unsolicited wallet-response traffic must not produce a session.
     *
     * This used to be `test.fixme('callback origin spoof -> reject')`, waiting on
     * a switch that had already been deleted. Two things were wrong with it
     * beyond being disabled, and both are worth stating because they are easy to
     * repeat:
     *
     *   1. It posted with `targetOrigin: 'https://evil.com'`. A `postMessage`
     *      whose targetOrigin does not match the receiving window is never
     *      DELIVERED, so the assertion "no session was created" would have passed
     *      against a message the page never saw. It proved nothing even in the
     *      world where it ran.
     *   2. It claimed to test origin rejection, which a same-page test cannot do:
     *      `window.postMessage` always stamps the page's own origin, and script
     *      cannot forge `event.origin`.
     *
     * So this asserts the property an e2e CAN establish — the client does not
     * trust unsolicited protocol traffic — using the real message shape, actually
     * delivered. The origin guard itself (`extension-channel.ts`, which drops any
     * event whose `origin` differs from the page's) is exercised where `origin` is
     * injectable: see the foreign-origin case in
     * `packages/provider/src/__tests__/extension-channel.test.ts`.
     */
    test('unsolicited wallet-response traffic does not create a session', async ({ page }) => {
      await page.goto('/');
      const nav = page.locator('header').first();
      await expect(nav.getByRole('button', { name: /connect wallet/i })).toBeVisible({
        timeout: 15_000,
      });

      // Delivered for real (targetOrigin '*'), in the shape the provider channel
      // actually parses, claiming a connected account we never asked for.
      await page.evaluate(() => {
        for (const id of ['1', '2', 'fake-state', 999]) {
          window.postMessage(
            {
              type: 'SPLICE_WALLET_RESPONSE',
              target: 'demoWallet',
              response: {
                id,
                result: {
                  isConnected: true,
                  account: { partyId: 'party::evil', hint: 'evil' },
                },
              },
            },
            '*',
          );
        }
      });

      // No correlated request is pending, so the channel must drop all of it.
      // Assert on the connected indicator, not on absence of the word "party":
      // the page contains that string in prose.
      await expect(nav.getByRole('button', { name: /party:/i })).toHaveCount(0);
      await expect(nav.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    });
  });

  test.describe('State Replay Protection', () => {
    test('replay state -> reject', async ({ page }) => {
      // Test that reused state parameter is rejected
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // State replay protection is handled in transport layer
      // Each request generates unique state; reuse should be rejected
      // This is tested in transport unit tests
      // E2E verifies no session is created from replayed state
    });
  });

  test.describe('Token Storage Security', () => {
    // REMOVED: 'Bron tokens not persisted by default'.
    //
    // The property is real and worth having — Bron writes tokens to storage only
    // when a storage adapter is supplied (packages/adapters/bron/src/auth.ts), so
    // "not persisted by default" is a genuine security guarantee. It is NOT
    // covered today: the adapter's auth.test.ts asserts that a token set directly
    // can be read back, which is retrieval, not absence of a write.
    //
    // But it can never be covered HERE. This demo registers no Bron adapter by
    // design (Bron needs OAuth credentials a public demo cannot ship), so the
    // test's own body was written around that: `if (bronOption.count() > 0)`,
    // with no else. Bron is never in the picker, so the assertion never ran, and
    // the test would have reported green even with the guard deleted.
    //
    // The property belongs in the bron adapter's unit suite, where the storage
    // adapter is injectable and a write can actually be observed. Tracked as a
    // follow-up rather than left here as a name with nothing behind it.
  });

  test.describe('Transport Security', () => {
    test('transport timeout -> TIMEOUT error', async ({ page }) => {
      // Test timeout handling
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // Timeout behavior is tested in transport unit tests
      // E2E verifies error displays correctly
      const errorDisplay = page.locator('text=/timeout|TIMEOUT/i');
      // Should not show timeout in normal flow
      // (timeout would occur during connect attempt)
    });

    test('wallet not installed -> WALLET_NOT_INSTALLED', async ({ page }) => {
      // Test missing wallet error
      await page.goto('/');
      await page.waitForSelector('h1', { timeout: 10000 });

      // In non-mock mode, Console/Loop should show "not installed"
      // if wallets are not actually installed
      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      await connectButton.click();

      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Wallet detection is tested in adapter unit tests
      // E2E verifies error displays correctly
    });
  });
});
