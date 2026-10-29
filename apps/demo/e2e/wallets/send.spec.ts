import { test, expect, type Page } from '@playwright/test';
import { SEND_KERNEL_ID } from '@partylayer/adapter-send';

/**
 * DOM-level smoke tests for the Send wallet adapter — registry-driven
 * detection model (Prompt 6).
 *
 * The real Send extension requires Touch ID / Face ID for any signing,
 * which Playwright cannot drive. These tests stub `window.canton`
 * before navigation and validate the picker-side surface only:
 *
 * The public showcase is Devnet. Send is Mainnet-only, so even a detected
 * Mainnet provider must not bypass the catalog's network filter. Canonical
 * and build-specific identities must not leak a raw kernel ID into the UI.
 * Other wallets remain available according to network and application config.
 * Mainnet discovery/identity matching is covered by the SDK contract tests;
 * this Devnet UI test does not establish real Send login or signing acceptance.
 *
 * Real account/passkey acceptance remains a separate manual check.
 */

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

async function openWalletModal(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('heading', { name: /One SDK for every/i }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Connect Wallet/i })).toBeVisible({
    timeout: 5000,
  });
}

test.describe('Send adapter — DOM-level smoke (registry-driven detection)', () => {
  test.describe('canonical Send install', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub(SEND_CANONICAL));
    });

    test('a canonical Mainnet Send provider stays out of the Devnet picker', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      // Wait for the real catalog before asserting absence.
      await expect(modal.getByText(/^Cantor8/i).first()).toBeVisible();
      await expect(modal.getByText(/^Send$/)).toHaveCount(0);
      await expect(modal.getByText(SEND_KERNEL_ID)).toHaveCount(0);
    });

    // Match the actual showcase channel and network. Config-dependent Bron
    // remains an explicit exception; a registry entry alone is not usable setup.
    const REGISTRY_PATH = '/registry/v1/beta/registry.json';

    /**
     * The one wallet the demo cannot register an adapter for. Not a defect and
     * not a data problem: `buildDemoAdapters()` omits it on purpose, and the SDK
     * then hides it because clicking it could only throw.
     */
    const UNCONNECTABLE = {
      id: 'bron',
      label: /^Bron/i,
      why: 'needs real OAuth credentials a public demo cannot ship, so the demo registers no adapter for it',
    };

    /**
     * Read the registry the demo actually serves, rather than the repo file or a
     * hand-copied list. This is the same bytes the SDK fetches, so the test and
     * the product cannot disagree about what a wallet is called.
     */
    async function registryWallets(page: Page): Promise<{ id: string; name: string; supportedNetworks: string[] }[]> {
      const res = await page.request.get(REGISTRY_PATH);
      expect(res.ok(), `${REGISTRY_PATH} must be served by the demo`).toBe(true);
      const body = (await res.json()) as { wallets: { id: string; name: string; supportedNetworks: string[] }[] };
      expect(body.wallets.length, 'registry must not be empty').toBeGreaterThan(1);
      return body.wallets;
    }

    /** Escape a display name so a wallet called "OneSwap V2" cannot act as a regex. */
    function literal(name: string): RegExp {
      return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    test('every configured Devnet wallet is offered despite the detected Mainnet provider', async ({ page }) => {
      const wallets = await registryWallets(page);
      const connectable = wallets.filter((w) => w.supportedNetworks.includes('devnet') && w.id !== UNCONNECTABLE.id);
      expect(connectable.length, 'the exception must not be the whole registry').toBeGreaterThan(3);

      await openWalletModal(page);
      const modal = page.getByRole('dialog');

      // Matched on the name the REGISTRY declares, which is what the picker
      // renders. A rename therefore moves both sides at once instead of reading
      // as a wallet that vanished.
      for (const w of connectable) {
        await expect(
          modal.locator('button').filter({ hasText: literal(w.name) }).first(),
          `"${w.name}" (${w.id}) supports Devnet and has the required runtime/configuration`,
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test('Bron is hidden because the demo cannot register it — gated, not lost', async ({ page }) => {
      // The distinction this test exists to draw. Both halves are required:
      // present in the registry (so the data is intact) AND absent from the
      // picker (so the SDK gated it). Assert only the second and a wallet
      // silently dropped from the registry would read as correct behaviour.
      const ids = (await registryWallets(page)).map((w) => w.id);
      expect(ids, `${UNCONNECTABLE.id} must still be IN the registry`).toContain(UNCONNECTABLE.id);

      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      await expect(
        modal.getByText(UNCONNECTABLE.label),
        `${UNCONNECTABLE.id} must NOT be offered: it ${UNCONNECTABLE.why}`,
      ).toHaveCount(0);
    });

    test('the rule is registration, not transport class', async ({ page }) => {
      // The control that makes the test above a rule rather than a coincidence.
      // Cantor8 and Nightly sit in the SAME class as Bron — no announce
      // transport, so they too can only connect through an adapter the app
      // registers. The demo registers theirs, so they are visible. The only
      // variable separating them from Bron is registration; without this,
      // "Bron is hidden" would be equally consistent with the SDK hiding every
      // adapter-backed wallet, which would be a real defect.
      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      for (const label of [/^Cantor8/i, /^Nightly/i]) {
        await expect(
          modal.getByText(label).first(),
          'a same-class wallet WITH a registered adapter must stay visible',
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('developer-mode Send install (build-specific kernel.id)', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(buildCantonStub(SEND_BUILD_SPECIFIC));
    });

    test('a build-specific Mainnet Send provider cannot bypass the Devnet filter', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      await expect(modal.getByText(/^Cantor8/i).first()).toBeVisible();
      await expect(modal.getByText(/^Send$/)).toHaveCount(0);
      await expect(modal.getByText(BUILD_SPECIFIC_KERNEL_ID)).toHaveCount(0);
    });
  });

  test('both public catalogs declare Send as Mainnet-only', async ({ request }) => {
    for (const channel of ['stable', 'beta']) {
      const response = await request.get(`/registry/v1/${channel}/registry.json`);
      expect(response.ok()).toBe(true);
      const registry = await response.json();
      const send = registry.wallets.find((wallet: { id: string }) => wallet.id === 'send');
      expect(send).toBeDefined();
      expect(send.name).toBe('Send');
      expect(send.supportedNetworks).toEqual(['mainnet']);
    }
  });

});
