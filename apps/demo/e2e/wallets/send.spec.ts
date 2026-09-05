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
 *   - Send-shaped status (canonical OR build-specific kernel.id) is
 *     promoted into the "CIP-0103 Native" section with proper Send
 *     branding (NOT the raw kernel.id string — the bug that triggered
 *     this architecture upgrade).
 *   - A truly foreign provider gets a generic CIP-0103 entry, NOT a
 *     "Send" entry. The kernel.id guard fires only on the connect
 *     attempt; the picker still surfaces every wallet.
 *   - Stubbing Send does not crowd the picker: every OTHER registry wallet is
 *     still offered. The one exception is asserted as a rule, not a headcount —
 *     see the block below the first test.
 *
 * Anything that requires a real passkey unlock is verified by the
 * adapter's vitest suite + manual E2E.
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

    test('Send appears in picker by name (NOT raw kernel.id) and is not flagged Beta', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
      // The pre-Prompt-6 bug rendered the raw extension id — verify it does NOT appear.
      await expect(modal.getByText(SEND_KERNEL_ID)).toHaveCount(0);
      // Stable release: the Beta badge must NOT render for Send anymore.
      await expect(modal.getByText('Beta', { exact: true })).toHaveCount(0);
    });

    /**
     * This replaces a test that asserted a fixed list of six wallet names.
     *
     * It failed for 38 consecutive nights (2026-07-30 .. 2026-09-05), and it was
     * right to fail: #265 deliberately widened the SDK's visibility rule from
     * `discovery-adapter` entries to EVERY wallet that needs an app-registered
     * adapter, and the demo deliberately does not register Bron's — it needs real
     * OAuth credentials a public demo cannot ship (canton-demo-adapter.ts). The
     * product changed; the headcount did not.
     *
     * A list of names rots exactly this way the next time the picker's contents
     * change, and it rots silently, because a name disappearing looks the same
     * whether it was hidden on purpose or lost by accident. So these tests assert
     * the RULE instead: which wallets the demo can connect, why the one it cannot
     * is absent, and that "absent" means gated rather than missing.
     *
     * The expectation is derived from the registry the demo actually serves, so
     * adding a wallet does not require editing this file. The single hardcoded
     * value is the exception itself, with its reason attached.
     */
    const REGISTRY_PATH = '/registry/v1/stable/registry.json';

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
    async function registryWallets(page: Page): Promise<{ id: string; name: string }[]> {
      const res = await page.request.get(REGISTRY_PATH);
      expect(res.ok(), `${REGISTRY_PATH} must be served by the demo`).toBe(true);
      const body = (await res.json()) as { wallets: { id: string; name: string }[] };
      expect(body.wallets.length, 'registry must not be empty').toBeGreaterThan(1);
      return body.wallets;
    }

    /** Escape a display name so a wallet called "OneSwap V2" cannot act as a regex. */
    function literal(name: string): RegExp {
      return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    test('every wallet the demo can connect is offered in the picker', async ({ page }) => {
      const wallets = await registryWallets(page);
      const connectable = wallets.filter((w) => w.id !== UNCONNECTABLE.id);
      expect(connectable.length, 'the exception must not be the whole registry').toBeGreaterThan(3);

      await openWalletModal(page);
      const modal = page.getByRole('dialog');

      // Matched on the name the REGISTRY declares, which is what the picker
      // renders. A rename therefore moves both sides at once instead of reading
      // as a wallet that vanished.
      for (const w of connectable) {
        await expect(
          modal.locator('button').filter({ hasText: literal(w.name) }).first(),
          `"${w.name}" (${w.id}) should be offered — the demo registers an adapter for it, or it connects via announce with no app adapter at all`,
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

    test('URL-domain matchers still identify it as Send (not raw kernel.id)', async ({ page }) => {
      await openWalletModal(page);
      const modal = page.getByRole('dialog');
      await expect(modal.getByText(/^Send$/)).toBeVisible({ timeout: 5000 });
      await expect(modal.getByText(BUILD_SPECIFIC_KERNEL_ID)).toHaveCount(0);
    });
  });

});
