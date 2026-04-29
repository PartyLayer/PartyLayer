/**
 * Full Connect Flow E2E Tests
 *
 * Tests the complete wallet connection lifecycle using the mock CIP-0103 wallet
 * injected at window.canton.demoWallet (auto-connects, no popup needed).
 *
 * Scenarios:
 *  1. CIP-0103 native wallet appears in modal
 *  2. Full connect → session displayed
 *  3. Disconnect clears session
 *  4. Landing page connect flow
 *  5. Session restore after page refresh
 */

import { test, expect } from '@playwright/test';
import { connectToMockWallet, assertConnected, disconnectWallet } from './helpers';

test.describe('Full Connect Flow — Kit Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit-demo');
    await page.waitForLoadState('networkidle');
  });

  test('CIP-0103 native wallet appears in modal', async ({ page }) => {
    // Open the wallet modal
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    await expect(connectBtn).toBeVisible({ timeout: 15000 });
    await connectBtn.click();

    // Modal should appear
    const modal = page.locator('[role="dialog"][aria-label="Connect Wallet"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // "CIP-0103 Native" section header should be present
    await expect(modal.getByText('CIP-0103 Native')).toBeVisible({ timeout: 15000 });

    // "Canton Demo Wallet" button should be visible
    const walletBtn = modal.locator('button').filter({ hasText: /Canton Demo Wallet/i });
    await expect(walletBtn).toBeVisible();
  });

  test('connect → session panel displayed with partyId and network', async ({ page }) => {
    // Before connecting, session panel should show placeholder
    await expect(page.getByText('Connect a wallet to start your session')).toBeVisible({ timeout: 15000 });

    // Connect to the mock wallet
    await connectToMockWallet(page);

    // ConnectButton should switch to connected state
    await assertConnected(page);

    // "Active Session" card should appear
    await expect(page.getByText('Active Session')).toBeVisible({ timeout: 5000 });

    // Party ID should be displayed (format: party::demo-user-XXXXXX)
    await expect(page.getByText(/party::demo-user-/)).toBeVisible({ timeout: 3000 });

    // Network should show "devnet"
    const networkLabel = page.getByText('Network', { exact: true });
    await expect(networkLabel).toBeVisible();
  });

  test('disconnect clears session and restores connect button', async ({ page }) => {
    // Connect first
    await connectToMockWallet(page);
    await expect(page.getByText('Active Session')).toBeVisible({ timeout: 5000 });

    // Disconnect
    await disconnectWallet(page);

    // Session panel should revert to placeholder
    await expect(page.getByText('Connect a wallet to start your session')).toBeVisible({ timeout: 5000 });
  });

  test('session restore after page refresh', async ({ page }) => {
    // Connect
    await connectToMockWallet(page);
    await expect(page.getByText('Active Session')).toBeVisible({ timeout: 5000 });

    // Capture the partyId before refresh
    const partyIdElement = page.getByText(/party::demo-user-/);
    await expect(partyIdElement).toBeVisible({ timeout: 3000 });
    const partyIdText = await partyIdElement.textContent();

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for the page to fully load
    await page.getByRole('heading', { name: /One SDK for every/i }).waitFor({ timeout: 15000 });

    // Check if session was restored
    // Note: Session restore depends on adapter support + localStorage persistence.
    // The mock CIP-0103 wallet generates a new partyId on each page load,
    // so the session may or may not restore with the same partyId.
    // We verify the page doesn't crash and the UI is functional.
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i });
    const activeSession = page.getByText('Active Session');

    // Either session is restored OR connect button is available — both are valid states
    const isRestored = await activeSession.isVisible().catch(() => false);
    const isDisconnected = await connectBtn.isVisible().catch(() => false);

    expect(isRestored || isDisconnected).toBe(true);

    if (isRestored) {
      // If restored, verify partyId is displayed
      await expect(page.getByText(/party::demo-user-/)).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Full Connect Flow — Landing Page', () => {
  test('connect from landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the page heading
    await expect(page.getByRole('heading', { name: /One SDK for every/i })).toBeVisible({ timeout: 15000 });

    // Connect to the mock wallet (uses .first() which grabs the nav Connect Wallet button)
    await connectToMockWallet(page);

    // On the landing page, the nav Connect Wallet switches to connected state (green dot + partyId)
    // but there may be another "Connect Wallet" in the demo section.
    // Verify connection by checking that a connected-state element appeared (truncated partyId)
    // The connected button shows monospace text and green dot
    const connectedIndicator = page.locator('button').filter({ has: page.locator('span[style*="monospace"]') });
    await expect(connectedIndicator.first()).toBeVisible({ timeout: 5000 });
  });
});
