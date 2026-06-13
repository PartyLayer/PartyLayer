import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * ISOLATED config for the Walley real-popup integration E2E (devnet).
 *
 * Kept separate from playwright.config.ts so the default e2e run is untouched.
 * Run explicitly:  playwright test --config playwright.walley.config.ts
 *
 * SECURITY: this spec drives a real recovery-phrase paste — a bearer credential.
 * trace / screenshot / video are OFF (not scrubbed — off) so nothing capturable
 * is ever written. The seed is read from a GIT-IGNORED .env into process.env
 * (the spec reads process.env only, never a file path) and skips when absent.
 */
loadEnv({ path: resolve(__dirname, '.env') }); // apps/demo/.env (git-ignored)
loadEnv({ path: resolve(__dirname, '../../.env') }); // repo-root .env (git-ignored)

const HARNESS_PORT = Number(process.env.WALLEY_HARNESS_PORT || 5273);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.spec.ts', // real-wallet integration specs only
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${HARNESS_PORT}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'walley-real', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/walley-harness/serve.mjs',
    url: `http://127.0.0.1:${HARNESS_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
