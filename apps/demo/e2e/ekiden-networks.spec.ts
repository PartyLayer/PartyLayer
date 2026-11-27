import { expect, test } from '@playwright/test';

const chromeStore = 'https://chromewebstore.google.com/detail/ekiden-wallet/dafiiombcijhkeajodhdclhmaajnjajb';

test('the wallet directory links to Ekiden on Testnet and Mainnet', async ({ page }) => {
  await page.goto('/wallets');
  const row = page.getByRole('row').filter({
    has: page.getByRole('link', { name: 'Ekiden Wallet', exact: true }),
  });
  await expect(row).toContainText('Beta');
  await expect(row).toContainText('testnet');
  await expect(row).toContainText('mainnet');

  await row.getByRole('link', { name: 'Ekiden Wallet', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Try on Mainnet' })).toHaveAttribute('href', '/kit-demo?network=mainnet');
  await page.getByRole('link', { name: 'Try on Testnet' }).click();

  const network = page.getByRole('combobox', { name: 'Canton network' });
  await expect(network).toHaveValue('testnet');
  await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
  const modal = page.getByRole('dialog', { name: 'Connect Wallet', exact: true });
  await modal.getByRole('button', { name: /Ekiden Wallet/i }).click();
  await expect(modal.locator(`a[href="${chromeStore}"]`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();

  await network.selectOption('devnet');
  await page.getByRole('button', { name: /Connect Wallet/i }).first().click();
  await expect(modal.getByRole('button', { name: /Vala Wallet/i })).toBeVisible();
  await expect(modal.getByRole('button', { name: /Ekiden Wallet/i })).toHaveCount(0);
});

test('the landing wallet list and Mainnet picker show the same Ekiden entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#wallets').getByRole('heading', { name: 'Ekiden Wallet', exact: true })).toBeVisible();

  const demo = page.locator('#demo');
  const network = demo.getByRole('combobox', { name: 'Canton network' });
  await expect(network).toHaveValue('devnet');
  await network.selectOption('mainnet');
  await expect(page).toHaveURL(/\?network=mainnet$/);
  await page.reload();
  await expect(network).toHaveValue('mainnet');
  await demo.getByRole('button', { name: 'Connect Wallet', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Connect Wallet', exact: true });
  await expect(modal.getByRole('button', { name: /Ekiden Wallet/i })).toHaveCount(1);
});
