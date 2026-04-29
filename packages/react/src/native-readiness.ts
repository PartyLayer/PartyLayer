/**
 * Adapter-aware readiness probing for the CIP-0103 NATIVE picker section.
 *
 * The picker shows the canonical CIP-0103 wallet list (Console + Send
 * today; any registry-flagged wallet in the future) regardless of
 * install state — but each row needs a runtime "Ready" / "Not installed"
 * indicator. The Prompt-6 model used `matchesProviderDetection` against
 * `window.canton`, which works for Send but always reports Console as
 * "Not installed" because Console uses postMessage, not window.canton.
 *
 * The fix is to ask each adapter its own `detectInstalled()` — every
 * adapter already knows its own transport. This module wraps that call
 * with a hard timeout + try/catch so a slow or buggy adapter cannot
 * block / crash the picker.
 *
 * Real adapters resolve in <100 ms in practice (Console: postMessage
 * probe; Send: window.canton + status RPC; Nightly: window.nightly
 * check). The 2.5 s ceiling is a defensive bound — if it ever fires in
 * production that's a real bug in the offending adapter, not a UX
 * trade-off here.
 */

/**
 * Minimum surface this module needs from a wallet adapter — narrowed
 * structurally so tests can pass plain stubs without instantiating the
 * full adapter classes.
 */
export interface DetectableAdapter {
  detectInstalled(): Promise<{ installed: boolean; reason?: string }>;
}

/** Default ceiling. Exposed so tests can pin the value. */
export const DEFAULT_DETECT_INSTALLED_TIMEOUT_MS = 2500;

/**
 * Probe an adapter's `detectInstalled()` and return a plain boolean.
 *
 * Resolves to `false` (not throwing) when:
 *   - the adapter throws synchronously or asynchronously
 *   - the probe doesn't settle within `timeoutMs`
 *   - the adapter resolves but `installed` is anything other than the
 *     literal boolean `true` (defensive against malformed payloads)
 */
export async function detectInstalledWithCeiling(
  adapter: DetectableAdapter,
  timeoutMs: number = DEFAULT_DETECT_INSTALLED_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const probe = adapter.detectInstalled();
    const result = await Promise.race([
      probe,
      new Promise<{ installed: false }>((resolve) =>
        setTimeout(() => resolve({ installed: false }), timeoutMs),
      ),
    ]);
    return result?.installed === true;
  } catch {
    return false;
  }
}
