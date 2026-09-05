/**
 * Session Restore E2E Test
 * 
 * Tests session restoration after page refresh using mock adapter.
 */

import { test, expect } from '@playwright/test';

test.describe('Session Restore', () => {
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
  test.fixme('session persists after page refresh', async ({ page, context }) => {
    // Set mock mode
    await page.goto('/?mockWallets=1');

    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Connect to a wallet (using Console as it supports restore)
    const connectButton = page.getByRole('button', { name: /connect/i }).first();
    await connectButton.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Find Console wallet option
    const consoleOption = page.locator('button, li').filter({ hasText: /console/i }).first();
    
    if (await consoleOption.count() > 0) {
      await consoleOption.click();
      
      // Wait for connection
      await page.waitForTimeout(2000);
      
      // Verify session is displayed
      const sessionInfo = page.locator('text=/party/i');
      await expect(sessionInfo).toBeVisible({ timeout: 5000 });
      
      // Get session party ID
      const partyIdText = await sessionInfo.textContent();
      expect(partyIdText).toBeTruthy();
      
      // Refresh page
      await page.reload();
      
      // Wait for page to load
      await page.waitForSelector('h1', { timeout: 10000 });
      
      // Verify session is still displayed (restored)
      const restoredSession = page.locator('text=/party/i');
      await expect(restoredSession).toBeVisible({ timeout: 5000 });
      
      // Verify party ID matches
      const restoredPartyId = await restoredSession.textContent();
      expect(restoredPartyId).toBe(partyIdText);
    } else {
      // Skip if Console not available
      test.skip();
    }
  });
});
