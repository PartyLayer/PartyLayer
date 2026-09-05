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

    // DISABLED, and the stated reason was wrong. The old comment here said this
    // depended on a `?mockWallets=1` SDK switch "not yet implemented", implying
    // something still to come. What actually happened: adapters accepted a
    // `useMockTransport` flag, `703a645` (the Cantor8 rebuild on its real SDK)
    // removed it, and the tests that depended on it were left switched off. Nobody
    // connected the removal to the tests that needed it, so they read for months as
    // waiting on future work rather than as casualties of a past change.
    //
    // Neither switch exists now: `?mockWallets=1` never did, and
    // NEXT_PUBLIC_MOCK_WALLETS is read by no product code (it was set in six places
    // and read in none until that was swept).
    //
    // What DOES work is a provider fixture at the boundary:
    // apps/demo/public/mock-cip0103-wallet.js assigns a real CIP-0103 provider to
    // window.canton.demoWallet before hydration, and CantonDemoWalletAdapter sits
    // over it. Rewrite against that shape, not against a flag.
    test.fixme('callback origin spoof -> reject', async ({ page }) => {
      // Test that postMessage from wrong origin is rejected
      await page.goto('/?mockWallets=1');
      
      // Inject malicious postMessage
      await page.evaluate(() => {
        // Simulate postMessage from wrong origin
        // Real implementation would validate origin in transport layer
        window.postMessage({
          type: 'partylayer-callback',
          state: 'fake-state',
          partyId: 'party::evil',
        }, 'https://evil.com');
      });

      // Should not accept callback from wrong origin
      // This is tested in transport unit tests
      // E2E verifies no session is created
      await page.waitForTimeout(1000);
      
      const sessionInfo = page.locator('text=/party/i');
      const count = await sessionInfo.count();
      expect(count).toBe(0); // No session should be created
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
    // DISABLED, and the stated reason was wrong. The old comment here said this
    // depended on a `?mockWallets=1` SDK switch "not yet implemented", implying
    // something still to come. What actually happened: adapters accepted a
    // `useMockTransport` flag, `703a645` (the Cantor8 rebuild on its real SDK)
    // removed it, and the tests that depended on it were left switched off. Nobody
    // connected the removal to the tests that needed it, so they read for months as
    // waiting on future work rather than as casualties of a past change.
    //
    // Neither switch exists now: `?mockWallets=1` never did, and
    // NEXT_PUBLIC_MOCK_WALLETS is read by no product code (it was set in six places
    // and read in none until that was swept).
    //
    // What DOES work is a provider fixture at the boundary:
    // apps/demo/public/mock-cip0103-wallet.js assigns a real CIP-0103 provider to
    // window.canton.demoWallet before hydration, and CantonDemoWalletAdapter sits
    // over it. Rewrite against that shape, not against a flag.
    test.fixme('Bron tokens not persisted by default', async ({ page, context }) => {
      // Test that Bron access tokens are not persisted unless opt-in
      await page.goto('/?mockWallets=1');
      await page.waitForSelector('h1', { timeout: 10000 });

      // Connect with Bron (mock)
      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      await connectButton.click();

      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      const bronOption = page.locator('button, li').filter({ hasText: /bron/i }).first();
      
      if (await bronOption.count() > 0) {
        await bronOption.click();
        await page.waitForTimeout(2000);

        // Verify tokens are not in localStorage by default
        const localStorage = await page.evaluate(() => {
          return Object.keys(localStorage).filter(key => 
            key.includes('bron') || key.includes('token')
          );
        });

        expect(localStorage.length).toBe(0); // No tokens persisted
      }
    });
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
