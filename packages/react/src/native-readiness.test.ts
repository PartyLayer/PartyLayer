/**
 * Coverage for the adapter-aware readiness probe used by the picker's
 * canonical CIP-0103 NATIVE section.
 *
 * The pre-Prompt-7.2 model only knew Send's transport (window.canton),
 * so Console always rendered as "Not installed" even when its extension
 * was active. The fix routes readiness through each adapter's own
 * `detectInstalled()` — every adapter knows its own transport
 * (Console: postMessage; Send: window.canton; Loop: SDK SDK probe).
 *
 * Three guarantees pinned here:
 *
 *   1. The probe NEVER throws — adapters that throw, hang, or return
 *      malformed payloads must never crash the picker.
 *   2. The 2.5 s ceiling fires deterministically — a hung adapter
 *      cannot block the modal indefinitely.
 *   3. The result is a strict boolean equality check — any non-`true`
 *      `installed` value (false, undefined, "yes" string, etc.) is
 *      treated as "not installed". This matches the conservative
 *      install-CTA UX: when in doubt, prompt the user to install.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DETECT_INSTALLED_TIMEOUT_MS,
  detectInstalledWithCeiling,
  type DetectableAdapter,
} from './native-readiness';

function adapter(impl: DetectableAdapter['detectInstalled']): DetectableAdapter {
  return { detectInstalled: impl };
}

describe('detectInstalledWithCeiling', () => {
  it('returns true when the adapter resolves with installed:true', async () => {
    const probe = vi.fn(async () => ({ installed: true }));
    expect(await detectInstalledWithCeiling(adapter(probe))).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('returns false when the adapter resolves with installed:false', async () => {
    expect(
      await detectInstalledWithCeiling(adapter(async () => ({ installed: false }))),
    ).toBe(false);
  });

  it('passes through reason without affecting the return value', async () => {
    expect(
      await detectInstalledWithCeiling(
        adapter(async () => ({ installed: false, reason: 'Browser environment required' })),
      ),
    ).toBe(false);
  });

  it('returns false when the adapter throws asynchronously', async () => {
    expect(
      await detectInstalledWithCeiling(
        adapter(async () => {
          throw new Error('boom');
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the adapter throws synchronously', async () => {
    expect(
      await detectInstalledWithCeiling(
        adapter(() => {
          throw new Error('sync boom');
        }),
      ),
    ).toBe(false);
  });

  it('returns false when the adapter resolves with a malformed payload', async () => {
    expect(
      await detectInstalledWithCeiling(
        adapter(async () => ({ installed: 'yes' as unknown as boolean })),
      ),
    ).toBe(false);
    expect(
      await detectInstalledWithCeiling(
        adapter(async () => ({ installed: 1 as unknown as boolean })),
      ),
    ).toBe(false);
    expect(
      await detectInstalledWithCeiling(
        adapter(async () => null as unknown as { installed: boolean }),
      ),
    ).toBe(false);
  });

  it('respects the 2.5s ceiling when the adapter hangs (default timeout)', async () => {
    vi.useFakeTimers();
    try {
      let resolveProbe: ((v: { installed: boolean }) => void) | null = null;
      const hung = adapter(
        () => new Promise<{ installed: boolean }>((resolve) => { resolveProbe = resolve; }),
      );
      const result = detectInstalledWithCeiling(hung);
      // Advance just before the ceiling — should still be pending.
      await vi.advanceTimersByTimeAsync(DEFAULT_DETECT_INSTALLED_TIMEOUT_MS - 1);
      // Crossing the ceiling resolves to false.
      await vi.advanceTimersByTimeAsync(2);
      expect(await result).toBe(false);
      // Resolving the original promise after the ceiling is harmless.
      resolveProbe?.({ installed: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours a custom timeout override', async () => {
    vi.useFakeTimers();
    try {
      const hung = adapter(() => new Promise<{ installed: boolean }>(() => {}));
      const result = detectInstalledWithCeiling(hung, 50);
      await vi.advanceTimersByTimeAsync(60);
      expect(await result).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait the full ceiling when the adapter resolves quickly', async () => {
    vi.useFakeTimers();
    try {
      const fast = adapter(async () => ({ installed: true }));
      const start = Date.now();
      const result = await detectInstalledWithCeiling(fast);
      const elapsed = Date.now() - start;
      expect(result).toBe(true);
      // Real-time check: even with fake timers running, microtasks resolve
      // immediately; the test must not have advanced any virtual time.
      expect(elapsed).toBeLessThan(50);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('detectInstalledWithCeiling: scenario coverage for canonical NATIVE section', () => {
  // Mirrors the prompt's scenarios A-D for adapter-driven readiness.
  // The full "section-building" pipeline runs in context.tsx; here we
  // pin the core mechanic — adapter probes — that drives those sections.

  it('Scenario A — no extensions: both adapters report not installed', async () => {
    const consoleA = adapter(async () => ({ installed: false, reason: 'extension missing' }));
    const sendA = adapter(async () => ({ installed: false }));
    expect(await detectInstalledWithCeiling(consoleA)).toBe(false);
    expect(await detectInstalledWithCeiling(sendA)).toBe(false);
  });

  it('Scenario B — Console only: Console ready, Send not', async () => {
    const consoleA = adapter(async () => ({ installed: true }));
    const sendA = adapter(async () => ({ installed: false }));
    expect(await detectInstalledWithCeiling(consoleA)).toBe(true);
    expect(await detectInstalledWithCeiling(sendA)).toBe(false);
  });

  it('Scenario C — Send only: Send ready, Console not', async () => {
    const consoleA = adapter(async () => ({ installed: false }));
    const sendA = adapter(async () => ({ installed: true }));
    expect(await detectInstalledWithCeiling(consoleA)).toBe(false);
    expect(await detectInstalledWithCeiling(sendA)).toBe(true);
  });

  it('Scenario D — both installed: both ready', async () => {
    const consoleA = adapter(async () => ({ installed: true }));
    const sendA = adapter(async () => ({ installed: true }));
    expect(await detectInstalledWithCeiling(consoleA)).toBe(true);
    expect(await detectInstalledWithCeiling(sendA)).toBe(true);
  });

  it('Scenario E — adapter throws: caller sees not installed (no crash)', async () => {
    const broken = adapter(async () => {
      throw new TypeError('cannot read window');
    });
    expect(await detectInstalledWithCeiling(broken)).toBe(false);
  });

  it('Scenario F — adapter hangs: caller sees not installed after ceiling', async () => {
    vi.useFakeTimers();
    try {
      const hung = adapter(() => new Promise<{ installed: boolean }>(() => {}));
      const probe = detectInstalledWithCeiling(hung, 100);
      await vi.advanceTimersByTimeAsync(101);
      expect(await probe).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('runs adapter probes concurrently — no per-adapter sequential blocking', async () => {
    vi.useFakeTimers();
    try {
      // Each adapter takes 1s; running concurrently the wall-clock should
      // be ~1s, not ~6s. Using fake timers we just confirm both resolve in
      // a single timer advance (no sequential waits).
      const slowAdapter = (val: boolean) =>
        adapter(
          () =>
            new Promise<{ installed: boolean }>((resolve) =>
              setTimeout(() => resolve({ installed: val }), 1000),
            ),
        );
      const probes = Promise.all([
        detectInstalledWithCeiling(slowAdapter(true)),
        detectInstalledWithCeiling(slowAdapter(false)),
        detectInstalledWithCeiling(slowAdapter(true)),
      ]);
      await vi.advanceTimersByTimeAsync(1100);
      expect(await probes).toEqual([true, false, true]);
    } finally {
      vi.useRealTimers();
    }
  });
});
