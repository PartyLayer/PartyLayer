import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** Controlled UI acceptance only; not vendor-wallet or physical-device certification. */
export default defineConfig({
  ...base,
  testMatch: ['**/accessibility.spec.ts', '**/docs-accessibility.spec.ts'],
  outputDir: 'test-results/compatibility',
  reporter: [['list'], ['json', { outputFile: 'test-results/compatibility.json' }]],
  workers: 1,
  projects: [
    { name: 'chromium-desktop', use: devices['Desktop Chrome'] },
    { name: 'firefox-desktop', use: devices['Desktop Firefox'] },
    { name: 'webkit-desktop', use: devices['Desktop Safari'] },
    { name: 'chromium-mobile', use: devices['Pixel 7'] },
    { name: 'webkit-mobile', use: devices['iPhone 13'] },
  ],
});
