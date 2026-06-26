import { test, expect } from '@playwright/test';

/**
 * CIP-0104 cost-visibility demo smoke test.
 *
 * Runs in FIXTURE mode (LEDGER_API_URL unset → the proxy serves a real captured
 * DevNet estimate). Requires no live validator. Asserts the estimate rows + total
 * render via CostPreview.
 */

test.describe('Cost visibility demo (/cost-demo)', () => {
  test('renders the pre-submission estimate rows + total (fixture mode)', async ({ page }) => {
    await page.goto('/cost-demo');

    // Page heading
    await expect(page.getByRole('heading', { name: /Transaction cost visibility/i })).toBeVisible();

    // CostPreview estimate rows (from the captured DevNet fixture: 2610 / 0 / 2610)
    await expect(page.getByText('Confirmation request')).toBeVisible();
    await expect(page.getByText('Confirmation response')).toBeVisible();
    await expect(page.getByText('Total', { exact: true })).toBeVisible();

    // The captured total value renders intact
    await expect(page.getByText('2610').first()).toBeVisible();

    // The post-execution "Actual paid" row is present (CostPreview's <dt>;
    // exact avoids also matching the "Actual paid cost" section heading)
    await expect(page.getByText('Actual paid', { exact: true })).toBeVisible();
  });
});
