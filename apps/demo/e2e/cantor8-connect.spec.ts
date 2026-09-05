/**
 * Cantor8 Connect E2E Test
 * 
 * Tests deep link connect flow using MockTransport in dev mode.
 */

import { test, expect } from '@playwright/test';

test.describe('Cantor8 Connect Flow', () => {
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
  test.fixme('cantor8 connect with mock transport', async ({ page }) => {
    // Set mock mode
    await page.goto('/?mockWallets=1');

    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check if Cantor8 wallet is listed
    const walletList = page.locator('ul').filter({ hasText: 'Cantor8' });
    await expect(walletList).toBeVisible();

    // Click connect button
    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    await connectButton.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Find Cantor8 in modal (if available)
    const cantor8Option = page.locator('button, li').filter({ hasText: /cantor8/i }).first();
    
    // If Cantor8 is available, click it
    if (await cantor8Option.count() > 0) {
      await cantor8Option.click();
      
      // Wait for connection (mock should return immediately)
      await page.waitForTimeout(2000);
      
      // Verify session is displayed
      const sessionInfo = page.locator('text=/party/i');
      await expect(sessionInfo).toBeVisible({ timeout: 5000 });
    } else {
      // Skip if Cantor8 not available in registry
      test.skip();
    }
  });
});
