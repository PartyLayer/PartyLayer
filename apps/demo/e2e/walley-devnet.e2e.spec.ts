/**
 * Walley devnet real-popup E2E.
 *
 * Drives a REAL connect against dev.walley.cc through the actual Walley popup
 * (recovery-phrase sign-in) and asserts the full lifecycle:
 *   connect → BOTH encrypted DBs persist → reload-RESTORE → connected →
 *   FIRST REQUEST after reload SUCCEEDS.
 *
 * The last step is the one that matters and was previously missing: showing
 * connected + persisted stores after reload is not enough, because the symptom of
 * the bug the sdk 0.17.0 restore fix addressed was precisely that the app looks
 * connected while the first request throws "Not connected" (the revived
 * discovery-adapter provider had no session). A read would not test it (the bridge
 * answers reads from the session snapshot); signMessage routes to the restored
 * provider, so it is the assertion that proves what we claim.
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

  // KNOWN OPEN BUG, documented not worked around. The harness uses the FACTORY form
  // (create(host), host from the registry). On reload the SDK's restoreSession runs
  // before the registry-driven networkHosts are injected (setNetworkHosts happens in
  // the warm/connect flow, not before restore), so GenericDiscoveryAdapter.restore
  // cannot resolveOfficial, falls through to as-is, and the first request throws
  // "provider requested before host resolution". Proven live against dev.walley.cc:
  // connect + persist + reload-connected all pass; only the post-reload request fails,
  // and NOT with the 0.17.0 "Not connected" symptom. The INSTANCE form (what
  // apps/tokenization and apps/dvp ship) sets `official` at construction, has no
  // networkHosts dependency, and passes this same test. Remove this test.fail once the
  // SDK resolves the factory adapter's host before restore on reload.
  test.fail();
  test('connect → both encrypted DBs persist → reload-restore → first request', async ({ page, context }) => {
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

    // The point of the fix (sdk 0.17.0): the FIRST REQUEST after reload must not throw
    // "Not connected". Showing connected + persisted stores is NOT enough, and a read
    // would not test it either, because the bridge answers reads from the session
    // snapshot (which survives reload regardless of the fix). signMessage routes to the
    // restored provider: the bug threw "Not connected" here before any popup, while the
    // fix reaches Walley's approval popup. Assert it reached the wallet (a popup opened,
    // or a signature returned) and did NOT throw "Not connected". The approval is not
    // completed; reaching the wallet rather than throwing is the proof.
    const sigPopupPromise = context.waitForEvent('page', { timeout: 20_000 }).catch(() => null);
    await page.getByTestId('do-request').click();
    const sigWindow = await sigPopupPromise;
    await page.waitForTimeout(1500); // let a synchronous "Not connected" throw surface
    const requestResult = await page.getByTestId('request-result').innerText();
    expect(requestResult, `post-reload signMessage result was: ${requestResult}`).not.toMatch(
      /not connected/i,
    );
    expect(
      sigWindow !== null || /^ok:/.test(requestResult),
      `signMessage should reach Walley after reload (popup or signature); result: ${requestResult}`,
    ).toBeTruthy();
    if (sigWindow) await sigWindow.close().catch(() => undefined);
  });
});
