import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectToMockWallet } from './helpers';

// Protocol fixture only: these checks exercise real browser keyboard behavior,
// not a real wallet or ledger submission.
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
  await page.goto('/kit-demo');
});

test('wallet dialog keeps Tab inside and restores the opener after Escape', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Connect Wallet', exact: true });
  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Powered by PartyLayer' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('account actions support keyboard navigation and Tab leaves the menu', async ({ page }) => {
  await connectToMockWallet(page);
  const trigger = page.locator('button[aria-haspopup="menu"]');
  await trigger.focus();
  await trigger.press('ArrowDown');
  const copy = page.getByRole('menuitem', { name: 'Copy address' });
  const disconnect = page.getByRole('menuitem', { name: 'Disconnect' });
  await expect(copy).toBeFocused();
  await page.keyboard.press('End');
  await expect(disconnect).toBeFocused();
  await page.keyboard.press('Home');
  await expect(copy).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.press('ArrowUp');
  await expect(disconnect).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(trigger).not.toBeFocused();
  await expect(page.getByRole('button', { name: 'Default', exact: true })).toBeFocused();
});

test('keyboard disconnect restores focus to Connect Wallet', async ({ page }) => {
  await connectToMockWallet(page);
  const trigger = page.locator('button[aria-haspopup="menu"]');
  await trigger.focus();
  await trigger.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Disconnect' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Connect Wallet', exact: true })).toBeFocused();
  await expect(page.getByText('Connect a wallet to start your session')).toBeVisible();
});

test('language and RTL changes preserve the connected account and keyboard actions', async ({
  page,
}) => {
  await connectToMockWallet(page);
  const identity = page
    .getByText('Party ID', { exact: true })
    .locator('..')
    .getByText(/party::demo-user-/);
  const original = await identity.textContent();
  await page.getByRole('combobox', { name: 'Wallet UI language' }).selectOption('tr');
  await page.getByRole('checkbox', { name: 'RTL', exact: true }).check();
  const trigger = page.locator('button[aria-haspopup="menu"]');
  await trigger.focus();
  await trigger.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Cüzdan hesabı' });
  await expect(menu).toHaveCSS('direction', 'rtl');
  await expect(page.getByRole('menuitem', { name: 'Adresi kopyala' })).toBeFocused();
  await expect(identity).toHaveText(original!);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Wallet UI language' }).selectOption('en');
  await expect(identity).toHaveText(original!);
  await trigger.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Disconnect' })).toBeFocused();
});

test('Turkish wallet dialog translates search and education in RTL layout', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Wallet UI language' }).selectOption('tr');
  await page.getByRole('checkbox', { name: 'RTL', exact: true }).check();
  await page.getByRole('button', { name: 'Cüzdan Bağla', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cüzdan Bağla' });
  await expect(dialog).toHaveAttribute('lang', 'tr');
  await expect(dialog).toHaveCSS('direction', 'rtl');
  await expect(dialog.getByRole('textbox', { name: 'Cüzdan ara' })).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Cüzdan ara' }).fill('No such wallet');
  await expect(dialog.getByText('“No such wallet” ile eşleşen cüzdan yok')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Cüzdan ara' }).fill('');
  await dialog.getByRole('button', { name: 'Canton cüzdanlarında yeni misiniz?' }).click();
  await expect(dialog.getByText(/Onay ve anahtar yönetimi cüzdanınızda gerçekleşir/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cüzdanları görüntüle' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/localized-wallet-dialog-rtl.png',
    animations: 'disabled',
  });
});

test('localized wallet controls and dialog fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: 'Wallet UI language' }).selectOption('tr');
  await page.getByRole('button', { name: 'Cüzdan Bağla', exact: true }).click();
  const dialog = page.locator('.pl-panel');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Canton Demo Wallet/ })).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: 'test-results/localized-wallet-dialog-mobile.png',
    animations: 'disabled',
  });
});
