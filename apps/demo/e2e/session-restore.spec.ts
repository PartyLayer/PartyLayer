/**
 * Session Restore E2E Test
 * 
 * Tests session restoration after page refresh using mock adapter.
 */

import { test, expect } from '@playwright/test';

test.describe('Session Restore', () => {
  test('session persists after page refresh', async ({ page, context }) => {
    // Set mock mode
    await page.goto('http://localhost:3000?mockWallets=1');

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
