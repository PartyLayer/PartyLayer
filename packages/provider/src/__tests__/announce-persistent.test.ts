// @vitest-environment jsdom
/**
 * Persistent announce subscription + resolve-on-arrival (the race fix).
 * Measures: late announces are now captured (were missed by the one-shot window),
 * inject-time announces are caught, teardown leaves no listener, and the existing
 * one-shot discoverAnnouncedProviders is unchanged (backward-compat).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  subscribeAnnouncedProviders,
  waitForAnnouncedProvider,
  discoverAnnouncedProviders,
} from '../discovery';

const ANNOUNCE = 'canton:announceProvider';
const REQUEST = 'canton:requestProvider';
const mockProvider = () =>
  ({ request: () => {}, on: () => {}, emit: () => false, removeListener: () => {} }) as never;
const opts = { createProvider: () => mockProvider() };
const tick = () => new Promise((r) => setTimeout(r, 0));
function announce(id: string) {
  window.dispatchEvent(new CustomEvent(ANNOUNCE, { detail: { providerId: id, name: id, target: id } }));
}

describe('subscribeAnnouncedProviders — persistent late-announce capture', () => {
  it('(a) captures an announce right after subscribe (within window)', async () => {
    const got: string[] = [];
    const off = subscribeAnnouncedProviders((p) => got.push(p.id), opts);
    announce('w-a');
    await tick();
    off();
    expect(got).toContain('w-a');
  });

  it('(b) captures a LATE announce long after subscribe — the fix (was missed)', async () => {
    const got: string[] = [];
    const off = subscribeAnnouncedProviders((p) => got.push(p.id), opts);
    await new Promise((r) => setTimeout(r, 600)); // well past any old fixed window
    announce('w-late');
    await tick();
    off();
    expect(got).toContain('w-late');
  });

  it('(c) captures an inject-time announce fired with NO requestProvider dispatch', async () => {
    const got: string[] = [];
    const off = subscribeAnnouncedProviders((p) => got.push(p.id), { ...opts, requestOnSubscribe: false });
    announce('w-inject'); // spontaneous (inject-time), we never prompted
    await tick();
    off();
    expect(got).toContain('w-inject');
  });

  it('(d) teardown removes the listener — no capture after unsubscribe, no leak', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const got: string[] = [];
    const off = subscribeAnnouncedProviders((p) => got.push(p.id), opts);
    off();
    expect(removeSpy).toHaveBeenCalledWith(ANNOUNCE, expect.any(Function)); // listener removed
    announce('w-after-off');
    await tick();
    expect(got).not.toContain('w-after-off'); // nothing captured post-teardown
    removeSpy.mockRestore();
  });
});

describe('waitForAnnouncedProvider — resolve-on-arrival', () => {
  it('resolves the MOMENT a matching late announce arrives', async () => {
    const p = waitForAnnouncedProvider((x) => x.id === 'w-match', { ...opts, timeoutMs: 1000 });
    setTimeout(() => announce('w-match'), 300); // late, within bound
    expect((await p)?.id).toBe('w-match');
  });

  it('resolves null after timeout when nothing matches', async () => {
    expect(await waitForAnnouncedProvider(() => true, { ...opts, timeoutMs: 50 })).toBeNull();
  });
});

describe('(f) backward-compat: discoverAnnouncedProviders unchanged', () => {
  it('zero announcers → []', async () => {
    expect(await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: () => mockProvider() })).toEqual([]);
  });

  it('within-window announcer → snapshot contains it', async () => {
    const handler = () => announce('w-snap'); // reply to requestProvider within the window
    window.addEventListener(REQUEST, handler);
    try {
      const res = await discoverAnnouncedProviders({ timeoutMs: 50, createProvider: () => mockProvider() });
      expect(res.map((r) => r.id)).toContain('w-snap');
    } finally {
      window.removeEventListener(REQUEST, handler);
    }
  });
});
