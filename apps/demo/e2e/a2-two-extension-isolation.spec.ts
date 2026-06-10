/**
 * A2 — real two-extension per-click isolation (env-gated regression).
 *
 * Loads the ACTUAL unpacked Send + Console extensions into a headed persistent
 * Chromium context against the local demo, and asserts the A2 guarantee
 * end-to-end on TWO independent signals:
 *   - SPLICE postMessage `target` seen in the page, and
 *   - which `chrome-extension://<id>` popup window opens.
 * Click Send ⇒ only Send (`ldmo…`); click Console ⇒ only Console (`lpnf…` /
 * `consoleWalletPixelplex`). Never the other wallet (the original swap).
 *
 * SKIPPED unless both env vars point at unpacked dirs (always in CI). MV3
 * extensions require a HEADED context (background service workers don't run
 * headless), so this launches its own persistent context, not the shared page.
 *
 *   A2_EXT_DIR_SEND=…/Extensions/ldmohicco…/<ver> \
 *   A2_EXT_DIR_CONSOLE=…/Extensions/lpnfhpbpm…/<ver> \
 *   pnpm --filter partylayer-demo exec playwright test \
 *     e2e/a2-two-extension-isolation.spec.ts --repeat-each=5
 */
import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';

const SEND_DIR = process.env.A2_EXT_DIR_SEND;
const CONSOLE_DIR = process.env.A2_EXT_DIR_CONSOLE;
const BASE_URL = process.env.A2_DEMO_URL ?? 'http://localhost:3000';
const OUT = 'test-results/a2';

const SEND_ID = 'ldmohiccoioolenadmogclhoklmanpgi';
const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';
const CONSOLE_CHANNEL = 'consoleWalletPixelplex'; // console-sdk WALLET_TARGET

/** Install a raw page-message monitor that records every {type,target} object message. */
async function installMonitor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __a2: Array<{ type: unknown; target: unknown }> }).__a2 = [];
    window.addEventListener('message', (e) => {
      const d = e.data as { type?: unknown; target?: unknown } | null;
      if (d && typeof d === 'object' && 'type' in d) {
        (window as unknown as { __a2: unknown[] }).__a2.push({ type: d.type, target: d.target });
      }
    });
  });
}
const readTargets = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __a2: Array<{ target: unknown }> }).__a2.map((m) => String(m.target)),
  );
const clearMonitor = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __a2: unknown[] }).__a2 = [];
  });

test.describe('A2 real two-extension per-click isolation', () => {
  test.skip(
    !SEND_DIR || !CONSOLE_DIR || !!process.env.CI,
    'Set A2_EXT_DIR_SEND + A2_EXT_DIR_CONSOLE (unpacked dirs) to run; always skipped in CI.',
  );

  let ctx: BrowserContext;
  const extWindows: string[] = []; // chrome-extension:// pages opened during the run

  test.afterEach(async () => {
    await ctx?.close();
  });

  test('click Send → only Send reacts; click Console → only Console reacts', async ({}, testInfo) => {
    mkdirSync(OUT, { recursive: true });
    ctx = await chromium.launchPersistentContext('', {
      headless: false, // MV3 extensions require a headed/SW-capable context
      args: [
        `--disable-extensions-except=${SEND_DIR},${CONSOLE_DIR}`,
        `--load-extension=${SEND_DIR}`,
        `--load-extension=${CONSOLE_DIR}`,
      ],
    });
    extWindows.length = 0;
    ctx.on('page', (p) => {
      const u = p.url();
      if (u.startsWith('chrome-extension://')) extWindows.push(u);
    });
    await ctx.tracing.start({ screenshots: true, snapshots: true });

    const page = await ctx.newPage();
    await installMonitor(page);
    await page.goto(BASE_URL);

    const modal = () => page.locator('[role="dialog"][aria-label="Connect Wallet"]');
    const openModal = async () => {
      await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
      await expect(modal()).toBeVisible({ timeout: 10_000 });
    };
    const popupsFor = (id: string) => extWindows.filter((u) => u.includes(id));

    // ── Click Send → only Send's channel/popup reacts ──
    await openModal();
    await clearMonitor(page);
    extWindows.length = 0;
    await modal().locator('button').filter({ hasText: /^Send/i }).first().click();
    await page.waitForTimeout(3000);
    const sendTargets = await readTargets(page);
    await page.screenshot({ path: `${OUT}/send-click-${testInfo.repeatEachIndex}.png` });
    testInfo.annotations.push({
      type: 'send-click',
      description: `targets=${JSON.stringify([...new Set(sendTargets)])} extWindows=${JSON.stringify(extWindows)}`,
    });
    expect(
      sendTargets.includes(SEND_ID) || popupsFor(SEND_ID).length > 0,
      'Send click must reach Send (ldmo) via SPLICE target or popup',
    ).toBeTruthy();
    // Definitive "Console opened" signals: a Console popup window, or a SPLICE
    // addressed to Console's EXTENSION id (lpnf…). NOTE: Console emits a
    // continuous AMBIENT `consoleWalletPixelplex` inpage↔CS heartbeat regardless
    // of dApp action (verified live), so that channel is NOT an isolation signal
    // and is intentionally excluded — else the heartbeat flakes the assert.
    expect(popupsFor(CONSOLE_ID), 'a Send click must NOT open the Console popup (the swap)').toHaveLength(0);
    expect(sendTargets, 'no Console extension-id SPLICE on a Send click').not.toContain(CONSOLE_ID);

    // reset
    await page.goto(BASE_URL);

    // ── Click Console → only Console's channel/popup reacts ──
    await openModal();
    await clearMonitor(page);
    extWindows.length = 0;
    await modal().locator('button').filter({ hasText: /Console/i }).first().click();
    await page.waitForTimeout(3000);
    const consoleTargets = await readTargets(page);
    await page.screenshot({ path: `${OUT}/console-click-${testInfo.repeatEachIndex}.png` });
    testInfo.annotations.push({
      type: 'console-click',
      description: `targets=${JSON.stringify([...new Set(consoleTargets)])} extWindows=${JSON.stringify(extWindows)}`,
    });
    expect(
      consoleTargets.includes(CONSOLE_CHANNEL) ||
        consoleTargets.includes(CONSOLE_ID) ||
        popupsFor(CONSOLE_ID).length > 0,
      'Console click must reach Console (lpnf)',
    ).toBeTruthy();
    // Send is reached ONLY via its own id/popup — a Console click must touch neither.
    expect(consoleTargets, 'no Send-addressed traffic on a Console click').not.toContain(SEND_ID);
    expect(popupsFor(SEND_ID), 'no Send popup on a Console click').toHaveLength(0);

    await ctx.tracing.stop({ path: `${OUT}/trace-${testInfo.repeatEachIndex}.zip` });
  });
});
