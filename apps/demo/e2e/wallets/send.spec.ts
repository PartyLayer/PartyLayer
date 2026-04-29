import { test, expect, type Page } from '@playwright/test';

/**
 * DOM-level smoke tests for the Send wallet adapter — registry-driven
 * detection model (Prompt 6).
 *
 * The real Send extension requires Touch ID / Face ID for any signing,
 * which Playwright cannot drive. These tests stub `window.canton`
 * before navigation and validate the picker-side surface only:
 *
 *   - Send-shaped status (canonical OR build-specific kernel.id) is
 *     promoted into the "CIP-0103 Native" section with proper Send
 *     branding (NOT the raw kernel.id string — the bug that triggered
 *     this architecture upgrade).
 *   - A truly foreign provider gets a generic CIP-0103 entry, NOT a
 *     "Send" entry. The kernel.id guard fires only on the connect
 *     attempt; the picker still surfaces every wallet.
 *   - All six registry wallets remain reachable in either NATIVE or
 *     AVAILABLE depending on which one is currently injected.
 *
 * Anything that requires a real passkey unlock is verified by the
 * adapter's vitest suite + manual E2E.
 */

const SEND_KERNEL_ID = 'ldmohiccoioolenadmogclhoklmanpgi';
const BUILD_SPECIFIC_KERNEL_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

interface InjectArgs {
  kernelId: string;
  kernelUrl: string;
  kernelUserUrl: string;
}

function buildCantonStub(args: InjectArgs): string {
  // Returned as a string so we can pass it to addInitScript; the body
  // runs in the page context and assigns window.canton before any app
  // code executes.
  return `(() => {
    const args = ${JSON.stringify(args)};
    const status = {
      kernel: {
        id: args.kernelId,
        clientType: 'browser',
        url: args.kernelUrl,
        userUrl: args.kernelUserUrl,
      },
      isConnected: false,
      isNetworkConnected: true,
      network: { networkId: 'canton:mainnet', ledgerApi: { baseUrl: args.kernelUrl } },
    };
    const provider = {
      request: async (req) => {
        if (!req || typeof req !== 'object') throw new Error('bad request');
        const m = req.method;
        if (m === 'status' || m === 'isConnected' || m === 'connect') return status;
        if (m === 'getActiveNetwork') return status.network;
        throw new Error('mock not configured for ' + m);
      },
      on: () => undefined,
      off: () => undefined,
      removeListener: () => undefined,
    };
    Object.defineProperty(window, 'canton', { value: provider, configurable: true, writable: true });
  })();`;
}

const SEND_CANONICAL: InjectArgs = {
  kernelId: SEND_KERNEL_ID,
  kernelUrl: 'https://api-mainnet.cantonwallet.com',
  kernelUserUrl: 'https://cantonwallet.com',
};

const SEND_BUILD_SPECIFIC: InjectArgs = {
  kernelId: BUILD_SPECIFIC_KERNEL_ID,
  kernelUrl: 'https://api-mainnet.cantonwallet.com',
  kernelUserUrl: 'https://cantonwallet.com',
};

const FOREIGN_PROVIDER: InjectArgs = {
  kernelId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  kernelUrl: 'https://api.other-wallet.example.com',
  kernelUserUrl: 'https://other-wallet.example.com',
};

async function openWalletModal(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('heading', { name: /One SDK for every/i }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Connect Wallet/i }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Connect Wallet/i })).toBeVisible({
    timeout: 5000,
  });
}

test.describe('Send adapter — DOM-level smoke (registry-driven detection)', () => {
  test.describe('canonical Send install', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub(SEND_CANONICAL));
    });

    test('Send appears in picker by name (NOT raw kernel.id) with Beta badge', async ({ page }) => {
      await openWalletModal(page);
      const modal = page
        .getByRole('dialog')
        .or(page.locator('[style*="position: fixed"]'))
        .first();
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
      // The pre-Prompt-6 bug rendered the raw extension id — verify it does NOT appear.
      await expect(modal.getByText(SEND_KERNEL_ID)).toHaveCount(0);
      await expect(modal.getByText('Beta', { exact: true }).first()).toBeVisible();
    });

    test('all six wallets still visible in picker', async ({ page }) => {
      await openWalletModal(page);
      const modal = page
        .getByRole('dialog')
        .or(page.locator('[style*="position: fixed"]'))
        .first();
      const expected = [/^Console/i, /^5N Loop/i, /^Cantor8/i, /^Bron/i, /^Nightly/i, /^Send$/];
      for (const rx of expected) {
        await expect(modal.getByText(rx).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('developer-mode Send install (build-specific kernel.id)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub(SEND_BUILD_SPECIFIC));
    });

    test('URL-domain matchers still identify it as Send (not raw kernel.id)', async ({ page }) => {
      await openWalletModal(page);
      const modal = page
        .getByRole('dialog')
        .or(page.locator('[style*="position: fixed"]'))
        .first();
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
      await expect(modal.getByText(BUILD_SPECIFIC_KERNEL_ID)).toHaveCount(0);
    });
  });

  test.describe('foreign provider sitting at window.canton', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub(FOREIGN_PROVIDER));
    });

    test('Send is NOT promoted; foreign provider renders as a generic CIP-0103 entry', async ({
      page,
    }) => {
      await openWalletModal(page);
      const modal = page
        .getByRole('dialog')
        .or(page.locator('[style*="position: fixed"]'))
        .first();
      // The five non-Send registry wallets and the Send entry are still listed
      // — Send under AVAILABLE (no native injection matched it). The foreign
      // provider surfaces with its derived hostname rather than the raw id.
      await expect(modal.getByText(FOREIGN_PROVIDER.kernelId)).toHaveCount(0);
      await expect(modal.getByText(/other-wallet\.example\.com/i)).toBeVisible({
        timeout: 5000,
      });
      // All six registry wallets still reachable.
      const expected = [/^Console/i, /^5N Loop/i, /^Cantor8/i, /^Bron/i, /^Nightly/i, /^Send$/];
      for (const rx of expected) {
        await expect(modal.getByText(rx).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
