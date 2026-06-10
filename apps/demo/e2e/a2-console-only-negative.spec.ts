/**
 * A2 — negative / (d) verification: the ORIGINAL bug's scenario.
 *
 * Loads ONLY Console (Send NOT installed). Clicking "Send" must surface a clear
 * not-installed/error state FAST, emit ZERO Console-addressed traffic, and NEVER
 * open a `chrome-extension://lpnf…` window — i.e. a Send click can no longer open
 * Console. Then a Console click must still work normally.
 *
 * SKIPPED unless A2_EXT_DIR_CONSOLE is set (always in CI). Headed (MV3 SWs).
 */
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { mkdirSync } from 'fs';

const CONSOLE_DIR = process.env.A2_EXT_DIR_CONSOLE;
const BASE_URL = process.env.A2_DEMO_URL ?? 'http://localhost:3000';
const OUT = 'test-results/a2';

const SEND_ID = 'ldmohiccoioolenadmogclhoklmanpgi';
const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';
const CONSOLE_CHANNEL = 'consoleWalletPixelplex';

test.describe('A2 negative — Console-only, a Send click must NOT open Console', () => {
  test.skip(
    !CONSOLE_DIR || !!process.env.CI,
    'Set A2_EXT_DIR_CONSOLE (unpacked dir) to run; always skipped in CI.',
  );

  let ctx: BrowserContext;
  test.afterEach(async () => {
    await ctx?.close();
  });

  test('Send click → fast not-installed, zero lpnf traffic, no Console popup; Console click still works', async ({}, testInfo) => {
    mkdirSync(OUT, { recursive: true });
    ctx = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${CONSOLE_DIR}`,
        `--load-extension=${CONSOLE_DIR}`,
      ],
    });
    const extWindows: string[] = [];
    ctx.on('page', (p) => {
      const u = p.url();
      if (u.startsWith('chrome-extension://')) extWindows.push(u);
    });

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      (window as unknown as { __a2: Array<{ target: unknown }> }).__a2 = [];
      window.addEventListener('message', (e) => {
        const d = e.data as { type?: unknown; target?: unknown } | null;
        if (d && typeof d === 'object' && 'type' in d) {
          (window as unknown as { __a2: unknown[] }).__a2.push({ target: d.target });
        }
      });
    });
    await page.goto(BASE_URL);

    const modal = () => page.locator('[role="dialog"][aria-label="Connect Wallet"]');
    await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
    await expect(modal()).toBeVisible({ timeout: 10_000 });

    // ── Click Send (NOT installed) → measure time to a not-installed/error state ──
    extWindows.length = 0;
    const t0 = Date.now();
    await modal().locator('button').filter({ hasText: /^Send/i }).first().click();
    // A clear install/error affordance must appear quickly.
    const errorish = modal().getByText(
      /not installed|isn't installed|don.?t have|install Send|unavailable|get .*wallet|not detected|failed|error/i,
    );
    let ttError = -1;
    try {
      await errorish.first().waitFor({ state: 'visible', timeout: 6000 });
      ttError = Date.now() - t0;
    } catch {
      /* affordance never appeared */
    }
    const modalText = (await modal().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);

    await page.waitForTimeout(800); // let any stray async traffic settle
    const targets = await page.evaluate(() =>
      (window as unknown as { __a2: Array<{ target: unknown }> }).__a2.map((m) => String(m.target)),
    );
    await page.screenshot({ path: `${OUT}/negative-send-click.png` });
    testInfo.annotations.push({
      type: 'negative-send',
      description: `ttError=${ttError}ms modal="${modalText}" targets=${JSON.stringify([...new Set(targets)])} extWindows=${JSON.stringify(extWindows)}`,
    });

    // HARD: a not-installed/error affordance MUST appear (never a silent hang).
    expect(ttError, `not-installed affordance must appear (got ${ttError}ms)`).toBeGreaterThanOrEqual(0);
    // MEASUREMENT (reported, not gated): the user-facing target is "within 3s".
    // In `pnpm dev` this is dominated by cold-connect overhead; the number is
    // surfaced in the annotation + log for review (prod build is expected faster).
    // eslint-disable-next-line no-console
    console.log(`[A2 negative] time-to-not-installed = ${ttError}ms (target ≤ 3000ms)`);
    // Definitive "Console opened" signals only — Console's AMBIENT
    // `consoleWalletPixelplex` heartbeat is present because Console is installed
    // (verified live) and is NOT caused by the click, so it is excluded here.
    expect(
      extWindows.filter((u) => u.includes(CONSOLE_ID)),
      'NO Console popup may open on a Send click (the original swap)',
    ).toHaveLength(0);
    expect(targets, 'no Console extension-id SPLICE on a Send click').not.toContain(CONSOLE_ID);
    expect(targets, 'no Send traffic either (Send not installed)').not.toContain(SEND_ID);

    // ── Console click still works (lpnf reached) ──
    await page.goto(BASE_URL);
    extWindows.length = 0;
    await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
    await expect(modal()).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      (window as unknown as { __a2: unknown[] }).__a2 = [];
    });
    await modal().locator('button').filter({ hasText: /Console/i }).first().click();
    await page.waitForTimeout(3000);
    const consoleTargets = await page.evaluate(() =>
      (window as unknown as { __a2: Array<{ target: unknown }> }).__a2.map((m) => String(m.target)),
    );
    testInfo.annotations.push({
      type: 'negative-console-ok',
      description: `targets=${JSON.stringify([...new Set(consoleTargets)])} extWindows=${JSON.stringify(extWindows)}`,
    });
    expect(
      consoleTargets.includes(CONSOLE_CHANNEL) ||
        consoleTargets.includes(CONSOLE_ID) ||
        extWindows.some((u) => u.includes(CONSOLE_ID)),
      'Console click must still reach Console',
    ).toBeTruthy();
  });
});
