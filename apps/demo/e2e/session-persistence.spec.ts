/**
 * Real-browser restoration over the current provider-owned session model.
 * The demo wallet fixture persists its own authorization, like an extension's
 * background context. The React store is an in-memory UI projection; an app
 * cache is never proof that the wallet remains connected.
 */
import { test, expect } from '@playwright/test';
import { connectToMockWallet, assertConnected, disconnectWallet } from './helpers';

test.describe('Provider-owned session restoration', () => {
  test('wallet-owned restore preserves identity and explicit logout reaches both tabs', async ({ page, context }) => {
    await page.goto('/');
    await connectToMockWallet(page);
    await assertConnected(page);

    const identity = await page.locator('header').first().getByRole('button', { name: /party:/i }).textContent();

    // Reload → restore: still connected after a full page reload.
    await page.reload();
    await assertConnected(page);
    await expect(page.locator('header').first().getByRole('button', { name: /party:/i })).toHaveText(identity!);

    // A second tab shares the mock wallet authorization and opt-in sync channel.
    const tabB = await context.newPage();
    await tabB.goto('/');
    await assertConnected(tabB); // restores the live session in the new tab

    // Both the SDK-backed header and session-store indicator must stop showing
    // a connected account after explicit logout, without reconnecting.
    await disconnectWallet(page);
    await expect(tabB.locator('header').first().getByRole('button', { name: /connect wallet/i })).toBeVisible({ timeout: 10_000 });
    await expect(tabB.locator('header').first().getByRole('button', { name: /party:/i })).toHaveCount(0);

    await expect(page.locator('[title="session: reconnecting"]')).toHaveCount(0);
    await expect(tabB.locator('[title="session: connected"]')).toHaveCount(0);
    await tabB.reload();
    await tabB.waitForLoadState('networkidle');
    await expect(tabB.locator('header').first().getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expect(tabB.locator('header').first().getByRole('button', { name: /party:/i })).toHaveCount(0);
    await tabB.close();
  });

  test('a stale application marker cannot restore a wallet that revoked authorization', async ({ page }) => {
    await page.goto('/');
    await connectToMockWallet(page);
    await assertConnected(page);
    await page.evaluate(() => {
      // This key belongs to the controlled wallet fixture, not the dApp SDK.
      localStorage.removeItem('__demo_wallet_session_v1');
      localStorage.setItem('partylayer.session.connected', 'true');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    const nav = page.locator('header').first();
    await expect(nav.getByRole('button', { name: /connect wallet/i })).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('button', { name: /party:/i })).toHaveCount(0);
    await expect(page.locator('[title="session: connected"]')).toHaveCount(0);
  });
});
