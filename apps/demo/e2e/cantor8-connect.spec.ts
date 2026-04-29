/**
 * Cantor8 Connect E2E Test
 * 
 * Tests deep link connect flow using MockTransport in dev mode.
 */

import { test, expect } from '@playwright/test';

test.describe('Cantor8 Connect Flow', () => {
  // FIXME: Depends on ?mockWallets=1 SDK switch which is not yet implemented.
  // The SDK has no URL-param-based mechanism to inject mock wallet providers
  // for E2E testing. Re-enable when that infrastructure ships (similar in
  // shape to apps/demo/src/lib/canton-demo-adapter.ts but for cantor8/bron/loop).
  // Tracked: see /tmp/mock-mode-investigation.md
  test.fixme('cantor8 connect with mock transport', async ({ page }) => {
    // Set mock mode
    await page.goto('http://localhost:3000?mockWallets=1');

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
