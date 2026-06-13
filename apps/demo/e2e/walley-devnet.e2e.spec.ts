/**
 * Walley devnet real-popup E2E.
 *
 * Drives a REAL connect against dev.walley.cc through the actual Walley popup
 * (recovery-phrase sign-in) and asserts the full lifecycle:
 *   connect → BOTH encrypted DBs persist → reload-RESTORE → (UI) connected.
 *
 * The reload-restore step is a HARD assertion: proven empirically (CASE i) —
 * our envelope-driven 1.0.1 persistence restores the session independently of
 * Walley's temporary recovery-phrase session.
 *
 * Runs only via:  playwright test --config playwright.walley.config.ts
 * Skips unless the throwaway devnet seed is in the env (git-ignored).
 *
 * SECURITY: the recovery phrase is a bearer credential. The walley config sets
 * trace/screenshot/video OFF. PHRASE/HINT are NEVER printed. Use a zero-value,
 * disposable devnet wallet only.
 */
import { test, expect } from '@playwright/test';
import { idbEntryCountScript, sessionKeyDbName, sessionDataDbName } from '@partylayer/testing';

const PHRASE = process.env.WALLEY_DEVNET_RECOVERY_PHRASE;
const HINT = process.env.WALLEY_DEVNET_PARTY_HINT;

test.describe('Walley devnet — real popup, recovery-phrase', () => {
  test.skip(
    !PHRASE || !HINT,
    'Set WALLEY_DEVNET_RECOVERY_PHRASE + WALLEY_DEVNET_PARTY_HINT (throwaway devnet seed) to run.',
  );

  test('connect → both encrypted DBs persist → reload-restore', async ({ page, context }) => {
    const words = (PHRASE as string).trim().split(/\s+/);
    // The Party Hint field expects the LABEL (placeholder "walley-alice"), i.e.
    // the portion before "::" — verified live. Never logged.
    const hintLabel = (HINT as string).split('::')[0];

    await page.goto('/'); // test-only harness: PartyLayerKit + WalleyAdapter@dev.walley.cc

    // Open the Kit modal and select Walley — the wallet-entry click triggers the
    // bridge connect (popup-safe fast-path) → Walley window.open, gesture-synchronous.
    await page.getByRole('button', { name: /connect/i }).first().click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    const popupPromise = context.waitForEvent('page');
    await modal.getByRole('button', { name: /walley/i }).first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    // Recovery-phrase sign-in (live UI labels, verified against dev.walley.cc):
    // "Use Recovery Phrase" → hint (placeholder "walley-alice") + 24 text inputs
    // → "Sign in with Recovery Phrase".
    await popup.getByRole('button', { name: /use recovery phrase/i }).click();
    await popup.getByPlaceholder('walley-alice').fill(hintLabel);
    const wordInputs = popup.locator('input[type="text"]');
    await expect(wordInputs).toHaveCount(words.length);
    for (let i = 0; i < words.length; i++) await wordInputs.nth(i).fill(words[i]);
    await popup.getByRole('button', { name: /sign in with recovery phrase/i }).click();
    await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);

    const status = page.getByTestId('session-status');
    await expect(status).toHaveText(/connected/i, { timeout: 30_000 });

    const dbCounts = async () => {
      const origin = await page.evaluate(() => window.location.origin);
      const key = (await page.evaluate(idbEntryCountScript(sessionKeyDbName(origin)))) as number;
      const data = (await page.evaluate(idbEntryCountScript(sessionDataDbName(origin)))) as number;
      return { key, data };
    };

    // Connect persisted BOTH encrypted stores (AES key + ciphertext envelope).
    const before = await dbCounts();
    expect(before.key).toBeGreaterThan(0);
    expect(before.data).toBeGreaterThan(0);

    // Reload → RESTORE (CASE i, proven): envelope-driven restore holds even
    // though Walley's recovery-phrase session is temporary.
    await page.reload();
    await expect(status).toHaveText(/connected/i, { timeout: 30_000 });
    const after = await dbCounts();
    expect(after.key).toBeGreaterThan(0);
    expect(after.data).toBeGreaterThan(0);
  });
});
