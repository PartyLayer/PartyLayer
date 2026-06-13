import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke tests for PartyLayer demo app
 * 
 * These tests validate basic functionality without requiring
 * real wallet extensions to be installed.
 */
export default defineConfig({
  testDir: './e2e',
  // Real-wallet integration specs (*.e2e.spec.ts) run only via their own config
  // (playwright.walley.config.ts) — they need a real wallet + secret, so they're
  // excluded from the default mock-based run.
  testIgnore: '**/*.e2e.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
