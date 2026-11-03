import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { selectWalletLanguage } from './helpers/language';

test.beforeEach(async ({ page }) => { await page.goto('/kit-demo'); });

test('searchable language selection is keyboard accessible and restores focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /^Wallet UI language:/ });
  await trigger.focus(); await trigger.press('ArrowDown');
  const search = page.getByRole('combobox', { name: 'Search languages' });
  await expect(search).toBeFocused();
  await search.fill('francais'); await expect(page.getByRole('option')).toHaveCount(1);
  await search.press('Enter'); await expect(trigger).toBeFocused(); await expect(trigger).toContainText('Français');
  await expect(page.getByRole('button', { name: 'Connecter un portefeuille', exact: true })).toBeVisible();
  await trigger.click();
  await page.getByRole('combobox').fill('zzzzzz'); await expect(page.getByText('Aucune langue trouvée')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

// Each locale gets its own browser context and timeout. A 14-dialog loop can
// exhaust a single 30-second CI budget even when individual interactions work.
const languages: Record<string, { connect: string; close: string }> = {
  en: { connect: 'Connect Wallet', close: 'Close' },
  tr: { connect: 'Cüzdan Bağla', close: 'Kapat' },
  es: { connect: 'Conectar cartera', close: 'Cerrar' },
  fr: { connect: 'Connecter un portefeuille', close: 'Fermer' },
  de: { connect: 'Wallet verbinden', close: 'Schließen' },
  pt: { connect: 'Conectar carteira', close: 'Fechar' },
  it: { connect: 'Collega portafoglio', close: 'Chiudi' },
  ru: { connect: 'Подключить кошелёк', close: 'Закрыть' },
  ar: { connect: 'ربط المحفظة', close: 'إغلاق' },
  hi: { connect: 'वॉलेट कनेक्ट करें', close: 'बंद करें' },
  id: { connect: 'Hubungkan dompet', close: 'Tutup' },
  ja: { connect: 'ウォレットを接続', close: '閉じる' },
  ko: { connect: '지갑 연결', close: '닫기' },
  zh: { connect: '连接钱包', close: '关闭' },
};
for (const [locale, labels] of Object.entries(languages)) {
  test(`${locale} translates the connection surface with the correct direction`, async ({ page }) => {
    await selectWalletLanguage(page, locale);
    const button = page.getByRole('button', { name: labels.connect, exact: true });
    await expect(button).toBeVisible(); await button.click();
    const dialog = page.getByRole('dialog', { name: labels.connect, exact: true });
    await expect(dialog).toHaveAttribute('lang', locale);
    await expect(dialog).toHaveCSS('direction', locale === 'ar' ? 'rtl' : 'ltr');
    // Wait for keyboard initialization before sending the next keyboard action.
    await expect(dialog.getByRole('button', { name: labels.close, exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  });
}

test('language picker fits mobile viewports and has no serious accessibility findings', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const locale of ['en', 'ar']) {
    await selectWalletLanguage(page, locale);
    await page.getByRole('button', { name: /^Wallet UI language:/ }).click();
    const picker = page.locator('[data-pl-language-picker]');
    const dialog = picker.getByRole('dialog'); await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const report = await new AxeBuilder({ page }).include('[data-pl-language-picker]').analyze();
    expect(report.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: /^Wallet UI language:/ }).click();
  await page.screenshot({ path: 'test-results/language-selector-mobile.png', animations: 'disabled' });
});
