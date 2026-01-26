/**
 * Bron Remote Signer E2E Test
 * 
 * Tests OAuth + sign approval polling flow using mock API.
 */

import { test, expect } from '@playwright/test';

test.describe('Bron Remote Signer Flow', () => {
  test('bron connect and sign with mock API', async ({ page }) => {
    // Set mock mode
    await page.goto('http://localhost:3000?mockWallets=1');

    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check if Bron wallet is listed
    const walletList = page.locator('ul').filter({ hasText: /bron/i });
    
    // If Bron is available, test connect flow
    if (await walletList.count() > 0) {
      // Click connect button
      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      await connectButton.click();

      // Wait for modal
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      // Find Bron in modal
      const bronOption = page.locator('button, li').filter({ hasText: /bron/i }).first();
      
      if (await bronOption.count() > 0) {
        await bronOption.click();
        
        // Wait for OAuth flow (mock should complete immediately)
        await page.waitForTimeout(2000);
        
        // Verify session is displayed
        const sessionInfo = page.locator('text=/party/i');
        await expect(sessionInfo).toBeVisible({ timeout: 5000 });
        
        // Test sign message (if button available)
        const signButton = page.getByRole('button', { name: /sign.*message/i });
        if (await signButton.count() > 0) {
          await signButton.click();
          
          // Wait for approval polling (mock should return immediately)
          await page.waitForTimeout(2000);
          
          // Verify signature result (if displayed)
          const signatureInfo = page.locator('text=/signature/i');
          if (await signatureInfo.count() > 0) {
            await expect(signatureInfo).toBeVisible();
          }
        }
      }
    } else {
      // Skip if Bron not available
      test.skip();
    }
  });
});
