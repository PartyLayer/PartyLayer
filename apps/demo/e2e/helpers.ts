/**
 * Shared E2E test helpers for PartyLayer demo app.
 *
 * Uses the mock CIP-0103 wallet injected at window.canton.demoWallet
 * which auto-connects without popup — perfect for headless Playwright tests.
 */

import { type Page, expect } from '@playwright/test';

/**
 * Connect to the mock CIP-0103 wallet via the WalletModal.
 *
 * Flow: Click "Connect Wallet" → Wait for modal → Click "Canton Demo Wallet" → Wait for modal close.
 */
export async function connectToMockWallet(page: Page): Promise<void> {
  const connectBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
  await expect(connectBtn).toBeVisible({ timeout: 15000 });
  await connectBtn.click();

  // Wait for the WalletModal to appear
  const modal = page.locator('[role="dialog"][aria-label="Connect Wallet"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Wait for wallet discovery — "Canton Demo Wallet" appears under CIP-0103 Native section
  const walletBtn = modal.locator('button').filter({ hasText: /Canton Demo Wallet/i });
  await expect(walletBtn).toBeVisible({ timeout: 15000 });

  // Click the mock wallet (auto-connects, no popup)
  await walletBtn.click();

  // Wait for success view then auto-close (800ms delay in modal)
  await expect(modal).not.toBeVisible({ timeout: 8000 });
}

/**
 * Assert the UI is in "connected" state.
 *
 * POSITIVE assertion: the Nav's connected indicator — the partyId chip that
 * toggles the session dropdown — is visible. The prior version asserted the
 * ABSENCE of any `/Connect Wallet/i` button page-wide, which is doctrinally
 * fragile: it collided with the *permanent* DemoCTA "Connect Wallet" CTA (a
 * modal-opener that is always visible regardless of session state), so once the
 * Nav button transitioned to connected, `.first()` resolved to that CTA and the
 * absence check failed even though the session was fully connected. Asserting
 * the connected state directly (it is PRESENT) cannot collide with unrelated
 * CTAs and is the more honest signal.
 */
export async function assertConnected(page: Page): Promise<void> {
  // Scope to the Nav header so the page's permanent "Connect Wallet" CTAs (which
  // live in <main>) can never interfere.
  const nav = page.locator('header').first();

  // Connected ⇒ the Nav renders the partyId chip (a button whose label is the
  // truncated partyId). The mock wallet's id is `party::demo-user-…`, and
  // truncatePartyId keeps the leading `party:` segment, so the chip's accessible
  // name contains `party:`. Generous timeout: restore-after-reload and new-tab
  // restore are async (the prior hardcoded 5s was tighter than the spec's own
  // 10s restore waits).
  const partyChip = nav.getByRole('button', { name: /party:/i });
  await expect(partyChip).toBeVisible({ timeout: 10_000 });

  // And the Nav's own connect button is gone (nav-scoped, so this does NOT
  // collide with the permanent CTAs elsewhere on the page).
  const navConnectBtn = nav.getByRole('button', { name: /connect wallet/i });
  await expect(navConnectBtn).toHaveCount(0);
}

/**
 * Disconnect the wallet via the ConnectButton dropdown.
 *
 * Flow: Click connected button → dropdown opens → Click "Disconnect" → Verify disconnected.
 */
export async function disconnectWallet(page: Page): Promise<void> {
  // The connected button contains monospace text with partyId — find it via the chevron icon's parent
  // The connected button is the only remaining non-modal button with a green dot
  // Strategy: look for the button that is NOT "Connect Wallet" in the nav area
  const connectedArea = page.locator('button').filter({ hasText: /party|demo/i });

  // If that doesn't work, try clicking the element with the green dot (8px circle with success color)
  if ((await connectedArea.count()) > 0) {
    await connectedArea.first().click();
  } else {
    // Fallback: the connected button is a monospace text element
    const anyBtn = page.locator('button').filter({ has: page.locator('span[style*="monospace"]') });
    await anyBtn.first().click();
  }

  // Wait for the dropdown with "Disconnect" button
  const disconnectBtn = page.getByRole('button', { name: 'Disconnect' });
  await expect(disconnectBtn).toBeVisible({ timeout: 3000 });
  await disconnectBtn.click();

  // Verify "Connect Wallet" button reappears
  const connectBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
  await expect(connectBtn).toBeVisible({ timeout: 5000 });
}
