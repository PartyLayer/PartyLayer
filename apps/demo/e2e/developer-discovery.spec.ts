import { test, expect } from '@playwright/test';

const guides = ['/docs/rainbowkit-for-canton', '/docs/integration-support'];

for (const route of guides) {
  test(`${route} is indexable with its own identity and an actionable installation`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://partylayer.xyz${route}`);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText('npm install @partylayer/react @tanstack/react-query');
    await expect(page.getByRole('main').getByRole('link', { name: /quick start/i }).first()).toHaveAttribute('href', '/docs/quick-start');
  });
}

test('homepage and wallet directory lead developers to the new guides', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Coming from RainbowKit? Build on Canton →' })).toHaveAttribute('href', guides[0]);
  await page.getByRole('link', { name: 'Coming from RainbowKit? Build on Canton →' }).click();
  await expect(page).toHaveURL(new RegExp(`${guides[0]}$`));
  await expect(page.getByRole('main')).toContainText('independent project');
  await page.goto('/wallets');
  await expect(page.getByRole('link', { name: 'React and Next.js quick start' })).toHaveAttribute('href', '/docs/quick-start');
  await expect(page.getByRole('link', { name: 'Integration help', exact: true })).toHaveAttribute('href', guides[1]);
});

test('support request uses the published integration form and guides enter the sitemap', async ({ page, request }) => {
  await page.goto(guides[1]);
  await expect(page.getByRole('link', { name: 'Open an integration support request' })).toHaveAttribute('href', 'https://github.com/PartyLayer/PartyLayer/issues/new?template=integration.yml');
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  for (const route of guides) expect(xml).toContain(`<loc>https://partylayer.xyz${route}</loc>`);
});
