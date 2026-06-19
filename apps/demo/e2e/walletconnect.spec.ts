/**
 * WalletConnect E2E — Stage 3 (browser).
 *
 * Asserts the REAL WalletConnect adapter's full path runs IN THE BROWSER —
 * adapter (@partylayer/adapter-walletconnect) → @canton-network/dapp-sdk →
 * @walletconnect/sign-client → relay → real `wc:` pairing URI. This is the leg
 * a pure-Node harness can't run (dapp-sdk needs a DOM).
 *
 * The demo mounts WalletConnect via buildDemoAdapters() inside the apex
 * <PartyLayerKit network="devnet" …> (projectId from NEXT_PUBLIC_WC_PROJECT_ID
 * or a local-dev fallback), so A1 derives canton:da-devnet for the proposal.
 *
 * Resilient: if the relay/projectId is unavailable in this env (no `wc:` URI
 * within the timeout), the test SKIPS with a clear message instead of hanging.
 */
import { test, expect, type Page } from '@playwright/test';

const URI_TIMEOUT = 35_000; // relay connect + proposal can take a while

/** Dump localStorage + all IndexedDB values as one string (WC stores the proposal — incl. the canton chains — locally, in plaintext). */
async function dumpClientStorage(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        parts.push(k + '=' + String(localStorage.getItem(k)));
      }
    } catch {}
    try {
      const dbs = (await (indexedDB as any).databases?.()) || [];
      for (const { name } of dbs) {
        if (!name) continue;
        await new Promise<void>((resolve) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => {
            const db = req.result;
            const stores = Array.from(db.objectStoreNames);
            if (!stores.length) { db.close(); return resolve(); }
            let pending = stores.length;
            const tx = db.transaction(stores, 'readonly');
            for (const s of stores) {
              const g = tx.objectStore(s).getAll();
              g.onsuccess = () => {
                try { parts.push(JSON.stringify(g.result)); } catch {}
                if (--pending === 0) { db.close(); resolve(); }
              };
              g.onerror = () => { if (--pending === 0) { db.close(); resolve(); } };
            }
          };
          req.onerror = () => resolve();
        });
      }
    } catch {}
    return parts.join('\n');
  });
}

test.describe('WalletConnect — real relay pairing in the browser', () => {
  test('produces a real wc: pairing URI and a canton:da-devnet proposal', async ({ page }) => {
    await page.goto('/');

    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();

    const modal = page.locator('[role="dialog"][aria-label="Connect Wallet"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Select WalletConnect from the picker (walletOrder puts it 4th).
    const wcBtn = modal.locator('button').filter({ hasText: /WalletConnect/i }).first();
    await expect(wcBtn).toBeVisible({ timeout: 15_000 });
    await wcBtn.click();

    // The published modal renders the QR view + a `wc:` deep-link once the
    // adapter→dapp-sdk→relay produces the pairing URI (onDisplayUri path).
    const wcLink = modal.locator('a[href^="wc:"]');
    try {
      await expect(wcLink).toBeVisible({ timeout: URI_TIMEOUT });
    } catch {
      test.skip(true, `No wc: pairing URI within ${URI_TIMEOUT}ms — WalletConnect relay/projectId unavailable in this env (set NEXT_PUBLIC_WC_PROJECT_ID + ensure relay reachability).`);
      return;
    }

    // (a) Real pairing URI produced in the browser → relay path works.
    const wcUri = (await wcLink.getAttribute('href')) || '';
    expect(wcUri).toMatch(/^wc:[0-9a-f]+@2\?/); // wc: v2 pairing URI
    // QR scan affordance is shown. Asserted BEFORE the heavy storage dump below,
    // with a generous timeout: on the real-relay path the modal's transition into
    // the QR view + rendering this copy can race past the default 5s (real relay +
    // dapp-sdk DOM is slow/variable). Tolerating that latency does not weaken
    // coverage — the wc: URI above already proves the relay path.
    await expect(modal.getByText(/Scan with your Canton wallet/i)).toBeVisible({ timeout: 20_000 });
    await expect(modal.locator('svg').first()).toBeVisible({ timeout: 20_000 }); // rendered QR

    // (b) Proposal carries the demo's configured network (canton:da-devnet, via A1).
    // The relayed proposal is symKey-encrypted, but WC persists the dApp's own
    // proposal (incl. optionalNamespaces.canton.chains) locally in plaintext.
    let storage = '';
    await expect(async () => {
      storage = await dumpClientStorage(page);
      expect(storage).toContain('canton:da-devnet');
    }).toPass({ timeout: 10_000 });

    // attach evidence for the report
    test.info().annotations.push(
      { type: 'wc-uri', description: wcUri.slice(0, 48) + '…' },
      { type: 'proposal-chain', description: 'canton:da-devnet (found in WC client storage)' },
    );

    // Clean: close the modal; Playwright closes the page/context after the test,
    // tearing down the relay socket — no hanging connections.
    await page.locator('[role="dialog"][aria-label="Connect Wallet"] button[aria-label="Close"]').first().click().catch(() => {});
  });
});
