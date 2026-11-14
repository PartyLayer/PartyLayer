import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { selectWalletLanguage } from './helpers/language';

// Controlled operation UI only. These fixtures do not certify a live wallet,
// a funded transfer, a hardware passkey, or a physical mobile device.
test.beforeEach(async ({ page }) => { await page.goto('/operation-preview'); });

test('reviews exact transfer intent before submitting and keeps ledger inclusion separate from settlement', async ({ page }, testInfo) => {
  await selectWalletLanguage(page, 'tr');
  const form = page.getByRole('region', { name: 'Token gönder', exact: true });
  await expect(form.getByRole('button', { name: 'Transferi incele' })).toBeEnabled();
  await form.getByLabel('Alıcı', { exact: true }).fill('party::receiver-preview');
  await form.getByLabel('Tutar', { exact: true }).fill('9007199254740993.1234567890');
  await form.getByRole('button', { name: 'Transferi incele' }).click();
  await expect(form.getByText('9007199254740993.1234567890 DEMO')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Cüzdanda onayla' })).toBeEnabled();
  await testInfo.attach('review', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await form.getByRole('button', { name: 'Cüzdanda onayla' }).click();
  await expect(form.getByText('İşlem ledger üzerinde doğrulandı')).toBeVisible();
  await expect(form.getByText('Transfer sonucu henüz doğrulanmadı')).toBeVisible();
  await expect(form.getByText('Transfer tamamlandı', { exact: true })).toHaveCount(0);
});

test('supports Arabic, narrow screens, both themes and accessible transfer controls', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 375, height: 812 });
  await selectWalletLanguage(page, 'ar');
  const form = page.getByRole('region', { name: 'إرسال الرموز', exact: true });
  await expect(form).toHaveAttribute('dir', 'rtl');
  await expect(form.getByRole('button', { name: 'مراجعة التحويل' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const theme of ['Dark', 'Light']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    // Measure the settled theme, after the existing account button's color
    // transition, rather than sampling an intermediate animation frame.
    await page.locator('main').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})));
    });
    const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  }
  await testInfo.attach('arabic-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('defaults to a supported browser language and falls back to English', async ({ browser, baseURL }) => {
  for (const [locale, expected] of [['tr-TR', 'tr'], ['sv-SE', 'en']]) {
    const context = await browser.newContext({ locale, baseURL });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/hydration|did not match/i.test(message.text())) errors.push(message.text()); });
      await page.goto('/operation-preview');
      await expect(page.locator('main section').first()).toHaveAttribute('lang', expected);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
});

test('contains long identifiers and exact large amounts at narrow widths and zoom', async ({ page }) => {
  await page.goto('/operation-preview?stress=1');
  await selectWalletLanguage(page, 'de');
  const form = page.getByRole('region', { name: 'Token senden', exact: true });
  await form.getByLabel('Empfänger', { exact: true }).fill(`party::${'r'.repeat(2041)}`);
  await form.getByLabel('Betrag', { exact: true }).fill('9999999999999999999999999999.1234567890');
  await form.getByRole('button', { name: 'Transfer prüfen' }).click();
  await expect(form.getByRole('button', { name: 'In der Wallet bestätigen' })).toBeEnabled();
  for (const locale of ['de', 'ar']) {
    await selectWalletLanguage(page, locale);
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const overflows = await page.locator('main section, main article, main button, main dd').evaluateAll(elements => elements
        .filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.tagName + ':' + el.textContent?.slice(0, 60)));
      expect(overflows).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 640, height: 900 });
  await page.addStyleTag({ content: 'html { zoom: 2; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
