import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectToMockWallet } from './helpers';

// Kit UI acceptance with a controlled development wallet. This does not test
// a vendor approval, cryptographic signature or real ledger operation.
test.beforeEach(async ({ page }) => {
  await page.route('**/v1/beta/registry.json', async (route) => {
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), '../../registry/v1/beta/registry.json'), 'utf8')
    );
    registry.wallets.push({
      id: 'canton-demo',
      name: 'Canton Demo Wallet',
      supportedNetworks: ['devnet'],
      capabilities: {
        signMessage: true,
        signTransaction: false,
        submitTransaction: false,
        transactionStatus: false,
        switchNetwork: false,
        multiParty: false,
      },
      adapter: { type: 'test-fixture' },
      cip0103: { native: true },
    });
    await route.fulfill({ status: 200, contentType: 'application/json', json: registry });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/kit-demo');
});

async function scan(page: Page, testInfo: TestInfo, selector: string) {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-report', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
      })),
      null,
      2
    )
  ).toEqual([]);
}

for (const mode of ['Light', 'Dark'] as const) {
  test(`${mode} wallet picker, search and education have accessible names and contrast`, async ({
    page,
  }, testInfo) => {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await page.getByRole('button', { name: 'Connect Wallet', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
    await expect(dialog.getByRole('button', { name: /Vala Wallet/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Vala Wallet/ })).toHaveAccessibleName(
      /^Vala Wallet (?!Vala Wallet)/
    );
    const searchStatus = dialog.getByRole('status');
    await expect(searchStatus).toBeEmpty();
    await scan(page, testInfo, '[role="dialog"]');
    await dialog.getByRole('textbox', { name: 'Search wallets' }).fill('No matching wallet');
    await expect(searchStatus).toHaveText('No wallets match “No matching wallet”');
    await expect(dialog.getByRole('textbox', { name: 'Search wallets' })).toBeFocused();
    await scan(page, testInfo, '[role="dialog"]');
    await dialog.getByRole('textbox', { name: 'Search wallets' }).fill('');
    await expect(searchStatus).toBeEmpty();
    await dialog.getByRole('button', { name: 'New to Canton wallets?' }).click();
    await expect(dialog.getByRole('button', { name: 'Browse wallets', exact: true })).toBeVisible();
    await scan(page, testInfo, '[role="dialog"]');
  });
}

test('mobile Turkish RTL picker supports reflow and accessible labels', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole('combobox', { name: 'Wallet UI language' }).selectOption('tr');
  await page.getByRole('checkbox', { name: 'RTL', exact: true }).check();
  await page.getByRole('button', { name: 'Cüzdan Bağla', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'tr');
  await expect(page.getByRole('dialog')).toHaveCSS('direction', 'rtl');
  await scan(page, testInfo, '[role="dialog"]');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('connected account menu has accessible labels, roles and contrast', async ({
  page,
}, testInfo) => {
  await connectToMockWallet(page);
  const trigger = page.locator('button[aria-haspopup="menu"]');
  await trigger.click();
  await expect(page.getByRole('menu', { name: 'Wallet account' })).toBeVisible();
  await scan(page, testInfo, '[role="menu"]');
});
