import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { selectWalletLanguage } from './helpers/language';

// Controlled operation UI only. These fixtures do not certify a live wallet,
// a funded transfer, a hardware passkey, or a physical mobile device.
test.beforeEach(async ({ page }) => { await page.goto('/operation-preview'); });

test('reviews exact transfer intent before submitting and keeps ledger inclusion separate from settlement', async ({ page }, testInfo) => {
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
});
