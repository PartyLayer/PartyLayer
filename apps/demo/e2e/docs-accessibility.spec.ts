import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1440, 320]) {
  for (const route of ['/docs', '/docs/installation', '/docs/quick-start']) {
    test(`documentation ${route} at ${width}px is readable and fits the viewport`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Search documentation/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'PartyLayer on GitHub', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: /^Search documentation/ })).toBeInViewport({ ratio: 1 });
      if (width === 320) {
        await expect(page.getByRole('button', { name: 'Toggle documentation navigation' })).toBeVisible();
      }
      const bounds = await page.getByRole('main').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      // The root can hide overflow while a flex child silently clips all prose.
      // Check the content bounds as well as the page scroll width.
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      await testInfo.attach('docs-axe-report', {
        body: JSON.stringify(results, null, 2), contentType: 'application/json',
      });
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }
}
