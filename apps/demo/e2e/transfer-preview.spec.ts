import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('reviews exact sample details and stops at a simulated wallet handoff', async ({ page }) => {
  const popups: string[] = [];
  const writes: string[] = [];
  page.on('popup', popup => popups.push(popup.url()));
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url());
  });

  await page.goto('/transfer-preview');
  await expect(page.getByText('Uses sample data.', { exact: false })).toBeVisible();
  const form = page.getByRole('region', { name: 'Send tokens' });
  await form.getByRole('textbox', { name: 'Recipient', exact: true }).fill('party::demo-receiver');
  await form.getByRole('textbox', { name: 'Amount', exact: true }).fill('9007199254740993.1234567890');
  await form.getByRole('button', { name: 'Review transfer' }).click();
  await expect(form.getByText('party::demo-receiver', { exact: true })).toBeVisible();
  await expect(form.getByText('9007199254740993.1234567890 DEMO')).toBeVisible();
  await expect(form.getByText('issuer::demo', { exact: true })).toBeVisible();

  await form.getByRole('button', { name: 'Edit transfer' }).click();
  await expect(form.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('9007199254740993.1234567890');
  await form.getByRole('button', { name: 'Review transfer' }).click();
  await form.getByRole('button', { name: 'Approve in wallet' }).press('Enter');

  const result = page.getByRole('heading', { name: 'Simulated wallet handoff' });
  await expect(result).toBeFocused();
  await expect(page.getByText('Nothing was signed or sent.', { exact: false })).toBeVisible();
  await expect(page.getByText(/transaction confirmed|transfer completed/i)).toHaveCount(0);
  expect(popups).toEqual([]);
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: 'Try another transfer' }).click();
  await expect(form.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('');
});

test('keeps the review visible and keyboard accessible on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 730 });
  await page.goto('/transfer-preview');
  await page.getByRole('textbox', { name: 'Recipient', exact: true }).fill(`party::${'r'.repeat(130)}`);
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('9007199254740993.1234567890');
  await page.getByRole('button', { name: 'Review transfer' }).press('Enter');
  const review = page.getByRole('region', { name: 'Send tokens' });
  await expect(review.getByText(/9007199254740993\.1234567890 DEMO/)).toBeVisible();
  expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});
