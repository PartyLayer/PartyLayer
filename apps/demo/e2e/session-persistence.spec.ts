/**
 * Real-browser session-persistence smoke (1.0 secure-by-default).
 *
 * Exercises the published session layer end-to-end in a real Chromium:
 *   persist (connect → encrypted IndexedDB) → reload → restore → multi-tab.
 *
 * Uses @partylayer/testing's browser primitives (IndexedDB assertions) and the
 * demo's existing mock-wallet helpers. Nightly + on-demand only (not PR-gated).
 */
import { test, expect, type Page } from '@playwright/test';
import { idbEntryCountScript, sessionKeyDbName } from '@partylayer/testing';
import { connectToMockWallet, assertConnected } from './helpers';

async function sessionKeyEntries(page: Page): Promise<number> {
  const origin = await page.evaluate(() => window.location.origin);
  return page.evaluate(idbEntryCountScript(sessionKeyDbName(origin))) as Promise<number>;
}

test.describe('Session persistence (1.0 secure-by-default)', () => {
  test('persist → reload-restore → multi-tab disconnect propagation', async ({ page, context }) => {
    await page.goto('/');
    await connectToMockWallet(page);
    await assertConnected(page);

    // Persist: the encrypted-IndexedDB default engaged ⇒ the origin-bound AES key
    // store holds at least one entry (the non-extractable CryptoKey).
    await expect.poll(() => sessionKeyEntries(page), { timeout: 10_000 }).toBeGreaterThan(0);

    // Reload → restore: still connected after a full page reload.
    await page.reload();
    await assertConnected(page);

    // Multi-tab: a second tab in the SAME context shares storage + BroadcastChannel.
    const tabB = await context.newPage();
    await tabB.goto('/');
    await assertConnected(tabB); // restores the live session in the new tab

    // Disconnect in tab A propagates to tab B (origin-bound broadcast).
    const disconnect = page.getByRole('button', { name: /disconnect/i }).first();
    if (await disconnect.count()) {
      // open the connected dropdown first if needed
      await disconnect.click().catch(() => {});
    }
    const connectBtnB = tabB.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtnB).toBeVisible({ timeout: 10_000 });

    await tabB.close();
  });
});
