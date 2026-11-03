import type { Page } from '@playwright/test';

export async function selectWalletLanguage(page: Page, locale: string) {
  await page.getByRole('button', { name: /^Wallet UI language:/ }).click();
  await page.locator(`[data-pl-language-picker] [role="option"][data-locale="${locale}"]`).click();
  await page.locator('[data-pl-language-picker] button[aria-haspopup="dialog"]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-pl-language-picker] button[aria-busy="true"]'));
}
