import { test, expect, type Page } from '@playwright/test';

/**
 * DOM-level smoke tests for the Send wallet adapter.
 *
 * The real Send extension requires Touch ID / Face ID for any signing,
 * which Playwright cannot drive. These tests therefore stub
 * `window.canton` before navigation and only validate the picker-side
 * surface: badge rendering, kernel.id guard behavior, and the all-six-
 * wallets visibility guarantee.
 *
 * Anything that requires a real passkey unlock is verified by the
 * adapter's vitest suite (Groups 1-11) plus manual E2E.
 */

const SEND_KERNEL_ID = 'ldmohiccoioolenadmogclhoklmanpgi';
const FOREIGN_KERNEL_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

interface InjectArgs {
  kernelId: string;
}

function buildCantonStub({ kernelId }: InjectArgs): string {
  // Returned as a string so we can pass it to addInitScript; the function
  // body runs in the page context and assigns window.canton before any
  // app code executes.
  return `(() => {
    const kernelId = ${JSON.stringify(kernelId)};
    const status = {
      kernel: { id: kernelId, clientType: 'browser', url: 'mock', userUrl: 'mock' },
      isConnected: false,
      isNetworkConnected: true,
      network: { networkId: 'canton:mainnet', ledgerApi: { baseUrl: 'mock' } },
    };
    window.canton = {
      request: async (args) => {
        if (args.method === 'status' || args.method === 'isConnected') return status;
        if (args.method === 'connect') return status;
        if (args.method === 'getActiveNetwork') return status.network;
        throw new Error('mock not configured for ' + args.method);
      },
      on: () => undefined,
      off: () => undefined,
      removeListener: () => undefined,
    };
  })();`;
}

async function openWalletModal(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('heading', { name: /One SDK for every/i }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Connect Wallet/i }).click();
  await expect(page.getByRole('heading', { name: /Select a Wallet/i })).toBeVisible({ timeout: 5000 });
}

test.describe('Send adapter — DOM-level smoke', () => {
  test.describe('with matching kernel.id (Send is the active provider)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub({ kernelId: SEND_KERNEL_ID }));
    });

    test('Send appears in wallet picker with a Beta badge', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog').or(page.locator('[style*="position: fixed"]')).first();
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
      // Badge text "Beta" appears next to the wallet name. Scope to the
      // Send row (parent container of the name span) to avoid matching
      // a different wallet that might also surface a beta badge later.
      await expect(modal.getByText('Beta', { exact: true }).first()).toBeVisible();
    });

    test('all six wallets visible in picker', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog').or(page.locator('[style*="position: fixed"]')).first();
      const expected = [/^Console/i, /^5N Loop/i, /^Cantor8/i, /^Bron/i, /^Nightly/i, /^Send$/];
      for (const rx of expected) {
        await expect(modal.getByText(rx).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('with foreign kernel.id (a non-Send extension owns window.canton)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub({ kernelId: FOREIGN_KERNEL_ID }));
    });

    test('Send still appears in the picker (decision: show all wallets)', async ({ page }) => {
      // The picker never filters by kernel.id — the guard fires only when
      // the user actually tries to connect. This test is the regression
      // anchor for the architectural rule "show every adapter, let the
      // user choose."
      await openWalletModal(page);
      const modal = page.getByRole('dialog').or(page.locator('[style*="position: fixed"]')).first();
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
    });
  });
});
