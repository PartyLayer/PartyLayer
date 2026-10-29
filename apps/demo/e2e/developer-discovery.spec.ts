import { test, expect } from '@playwright/test';

const guides = ['/docs/rainbowkit-for-canton', '/docs/integration-support', '/docs/migration', '/docs/ai-integration'];

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

test('playground exposes useful initial HTML and hydrates into the working connection UI', async ({ page, request }) => {
  const response = await request.get('/kit-demo');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toMatch(/<h1\b[^>]*>\s*Canton wallet connection playground\s*<\/h1>/);
  expect(html).toContain('href="/docs/quick-start"');
  expect(html).toContain('This demo uses Devnet');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/kit-demo');
  await expect(page.getByRole('heading', { level: 1, name: /One SDK for every/ })).toBeVisible();
  await page.getByRole('button', {name: /Connect Wallet/i}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors.filter(message => /hydrat|server.render|did not match/i.test(message))).toEqual([]);
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toMatch(/<lastmod>|<priority>|<changefreq>/);
});

test('AI references expose the current installation and wallet scope as plain text', async ({ page, request }) => {
  await page.goto('/docs');
  await expect(page.getByRole('link',{name:'plain-text integration reference'})).toHaveAttribute('href','/llms-full.txt');
  await expect(page.getByRole('link',{name:'documentation index',exact:true})).toHaveAttribute('href','/llms.txt');
  const index = await request.get('/llms.txt');
  expect(index.ok()).toBe(true);
  expect(index.headers()['content-type']).toContain('text/plain');
  expect(await index.text()).toContain('https://partylayer.xyz/docs/rainbowkit-for-canton');
  const full = await request.get('/llms-full.txt');
  expect(full.ok()).toBe(true);
  expect(full.headers()['content-type']).toContain('text/plain');
  const text = await full.text();
  expect(text).toContain('npm install @partylayer/react @tanstack/react-query');
  expect(text).not.toContain('npm install @partylayer/sdk @partylayer/react');
  expect(text).toContain('| Vala Wallet | devnet | beta |');
  expect(text).toContain('| Send | mainnet | stable |');
  expect(text).toContain('single-use nonce');
  expect(text).toContain('independently confirms ledger settlement');
});

test('the conventional favicon URL serves a real icon and is declared in the page', async ({ request, page }) => {
  const icon = await request.get('/favicon.ico');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toMatch(/image\/(?:x-icon|vnd\.microsoft\.icon)/);
  expect((await icon.body()).subarray(0,4)).toEqual(Buffer.from([0,0,1,0]));
  await page.goto('/docs');
  await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveCount(1);
});

test('wallet search previews describe the included kit rather than a separate wallet installation', async ({ page }) => {
  await page.goto('/wallets/console');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Wallet runtimes are included/);
  await expect(page.getByRole('main')).toContainText('npm install @partylayer/react @tanstack/react-query');
});
