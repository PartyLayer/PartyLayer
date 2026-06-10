// @vitest-environment jsdom
/**
 * Announce-based discovery (canton:announceProvider) tests.
 *
 * Simulates the EIP-6963-style handshake in jsdom: a mock "extension" listens
 * for `canton:requestProvider` and replies with `canton:announceProvider`
 * CustomEvents. The resolved provider is injected via the `createProvider`
 * option (an inline CIP-0103 mock), so these tests exercise the discovery +
 * dedup logic without the real ExtensionAdapter postMessage transport (and
 * without a workspace cycle on @partylayer/testing).
 *
 * Critical case: an announce-only wallet (Send) is found EVEN WHEN
 * window.canton is owned by a different, non-matching provider (Console) — the
 * exact "Send missed today" production bug.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CIP0103Provider } from '@partylayer/core';
import {
  discoverAnnouncedProviders,
  discoverInjectedProviders,
  discoverProviders,
  isCIP0103Provider,
  type AnnouncedWallet,
} from '../discovery';

// Capture the `target` the DEFAULT announce→provider factory routes to.
// (The existing tests inject `createProvider` and never hit the real factory,
// so mocking extension-channel here only affects the G4 default-factory tests.)
vi.mock('../extension-channel', () => ({
  createExtensionChannelProvider: vi.fn((opts?: { target?: string }) => ({
    __target: opts?.target,
    request: async () => ({}),
    on() {
      return this;
    },
    emit() {
      return true;
    },
    removeListener() {
      return this;
    },
  })),
}));

const REQUEST_EVENT = 'canton:requestProvider';
const ANNOUNCE_EVENT = 'canton:announceProvider';

/** A minimal CIP-0103 provider, optionally carrying its own extension `id`. */
function mockProvider(id?: string): CIP0103Provider {
  const p = {
    id,
    request: async () => ({}),
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as CIP0103Provider;
}

/** Stand up a mock extension that announces `details` when a request fires. */
function mockExtension(details: Array<Record<string, unknown>>): () => void {
  const handler = (): void => {
    for (const detail of details) {
      window.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail }));
    }
  };
  window.addEventListener(REQUEST_EVENT, handler);
  return () => window.removeEventListener(REQUEST_EVENT, handler);
}

/** Injected createProvider: resolve each announce to a mock with the same id. */
const resolveMock = (a: AnnouncedWallet): CIP0103Provider => mockProvider(a.id);

function setWindowCanton(p: CIP0103Provider | undefined): void {
  if (p) (window as unknown as { canton?: unknown }).canton = p;
  else delete (window as unknown as { canton?: unknown }).canton;
}

afterEach(() => {
  setWindowCanton(undefined);
});

describe('discoverAnnouncedProviders', () => {
  it('returns an announced wallet as a working CIP-0103 provider', async () => {
    const stop = mockExtension([
      { providerId: 'send-id', name: 'Send', icon: 'data:img', target: 'send-target' },
    ]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();

    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('send-id');
    expect(res[0].name).toBe('Send');
    expect(res[0].icon).toBe('data:img');
    expect(res[0].source).toBe('injected');
    expect(isCIP0103Provider(res[0].provider)).toBe(true);
  });

  it('tolerates the `id` field (not just `providerId`) in the announce detail', async () => {
    const stop = mockExtension([{ id: 'send-id', name: 'Send' }]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    expect(res.map((r) => r.id)).toEqual(['send-id']);
  });

  it('dedups duplicate announce replies with the same id', async () => {
    const stop = mockExtension([
      { providerId: 'send-id', name: 'Send' },
      { providerId: 'send-id', name: 'Send (dup)' },
    ]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    expect(res).toHaveLength(1);
  });

  it('returns [] when nothing announces', async () => {
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    expect(res).toEqual([]);
  });
});

describe('discoverProviders — the "Send missed" production scenario', () => {
  it('finds an announce-only wallet EVEN WHEN window.canton is owned by a different, non-matching provider', async () => {
    // Console owns the single window.canton slot…
    setWindowCanton(mockProvider('console-id'));
    // …and Send only advertises via announce.
    const stop = mockExtension([
      { providerId: 'send-id', name: 'Send', icon: 'data:send', target: 'send-target' },
    ]);

    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();

    // Send IS discovered (the bug: today it would be missed) …
    const send = result.find((r) => r.id === 'send-id');
    expect(send).toBeDefined();
    expect(isCIP0103Provider(send!.provider)).toBe(true);
    // … and the window.canton owner (Console) is still present too.
    expect(
      result.some((r) => (r.provider as unknown as { id?: string }).id === 'console-id'),
    ).toBe(true);
  });
});

describe('discoverProviders — dedup + no-regression', () => {
  it('Console reachable via BOTH window.canton AND announce appears EXACTLY ONCE', async () => {
    setWindowCanton(mockProvider('console-id')); // window.canton owner, provider.id = console-id
    const stop = mockExtension([
      { providerId: 'console-id', name: 'Console', icon: 'data:c', target: 'c-target' },
    ]);

    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();

    const consoleEntries = result.filter(
      (r) => r.id === 'console-id' || (r.provider as unknown as { id?: string }).id === 'console-id',
    );
    expect(consoleEntries).toHaveLength(1); // collapsed to one canonical provider
    expect(isCIP0103Provider(consoleEntries[0].provider)).toBe(true);
    // A2.1: a RESOLVED injected entry carries its REAL provider id (not the
    // 'canton' scan path id), so the SDK bridge can match it.
    expect(consoleEntries[0].id).toBe('console-id');
    expect(consoleEntries[0].identityResolved).toBe(true);
  });

  it('a window.canton-owning wallet that does NOT announce still appears once', async () => {
    setWindowCanton(mockProvider('solo-id'));
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    const solo = result.filter(
      (r) => (r.provider as unknown as { id?: string }).id === 'solo-id',
    );
    expect(solo).toHaveLength(1);
  });

  it('with no announces, returns exactly the window.canton scan results (shape unchanged)', async () => {
    setWindowCanton(mockProvider('solo-id'));
    const injected = discoverInjectedProviders();
    const merged = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });

    expect(merged).toHaveLength(injected.length);
    // existing return shape preserved for consumers
    for (const entry of merged) {
      expect(typeof entry.id).toBe('string');
      expect(entry.source).toBe('injected');
      expect(isCIP0103Provider(entry.provider)).toBe(true);
    }
  });
});

// ── Live Console/Send reality (PR #18 dedup defect) ──────────────────────────

/**
 * Console-like injected provider: NO top-level `id` (only request/on/emit/
 * removeListener/source), stable id available ONLY via status().provider.id —
 * the exact live shape that caused Console to be listed twice.
 */
function consoleLikeInjected(statusId: string): CIP0103Provider {
  const p = {
    source: 'console',
    request: async (args: { method: string }) => {
      if (args.method === 'status') return { provider: { id: statusId } };
      return {};
    },
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as CIP0103Provider;
}

/** Injected provider whose status() NEVER resolves (non-responsive). */
function hangingInjected(): CIP0103Provider {
  const p = {
    source: 'stuck',
    request: () => new Promise<never>(() => {}), // never resolves
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as CIP0103Provider;
}

describe('discoverProviders — live Console/Send reality', () => {
  it('dedups Console to ONE entry when window.canton has NO top-level id (status-based), keeping the INJECTED provider', async () => {
    const injected = consoleLikeInjected('lpnf');
    setWindowCanton(injected);
    const stop = mockExtension([{ providerId: 'lpnf', target: 'lpnf', name: 'Console' }]);

    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();

    const consoleEntries = result.filter(
      (r) =>
        r.id === 'lpnf' ||
        r.id === 'canton' ||
        (r.provider as unknown as { id?: string }).id === 'lpnf',
    );
    expect(consoleEntries).toHaveLength(1); // not twice
    // The kept entry is the direct window.canton provider, not the announce shim.
    // A2.1: its id is the RESOLVED status id ('lpnf'), not the 'canton' path id.
    expect(consoleEntries[0].id).toBe('lpnf');
    expect(consoleEntries[0].provider).toBe(injected);
  });

  it('an OFFLINE announce wallet (Send: announces, no window.canton, status never responds) appears once and does NOT delay discovery', async () => {
    // No window.canton. Send announces but its channel provider never responds.
    const stop = mockExtension([{ providerId: 'ldmoh', target: 'ldmoh', name: 'Send' }]);

    const start = Date.now();
    // No createProvider override → default native channel provider (offline-safe:
    // announce entries are NOT status-probed by discoverProviders).
    const result = await discoverProviders({ timeoutMs: 0 });
    const elapsed = Date.now() - start;
    stop();

    expect(elapsed).toBeLessThan(1000); // nowhere near the 30s channel timeout
    const send = result.filter((r) => r.id === 'ldmoh');
    expect(send).toHaveLength(1);
    expect(isCIP0103Provider(send[0].provider)).toBe(true);
  });

  it('caps the injected status() id-probe so a non-responsive window.canton can NEVER block discovery', async () => {
    setWindowCanton(hangingInjected());
    const start = Date.now();
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    const elapsed = Date.now() - start;

    // Falls back to the path id after the ~1500ms cap; appears exactly once.
    expect(elapsed).toBeLessThan(5000);
    const entries = result.filter((r) => r.id === 'canton');
    expect(entries).toHaveLength(1);
  });

  it('a window.canton owner with no id and no announce still appears exactly once', async () => {
    setWindowCanton(consoleLikeInjected('solo'));
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    // A2.1: keyed by its RESOLVED status id ('solo'), not the 'canton' path id.
    const entries = result.filter((r) => r.id === 'solo');
    expect(entries).toHaveLength(1);
    expect(entries[0].identityResolved).toBe(true);
  });
});

describe('G4 — default factory routes target ?? id (canonical provider.md)', () => {
  it('an announce WITHOUT target routes its provider to the announce id', async () => {
    const stop = mockExtension([{ id: 'wallet-no-target', name: 'NoTarget' }]);
    // No createProvider override → exercises defaultAnnounceProvider.
    const res = await discoverAnnouncedProviders({ timeoutMs: 0 });
    stop();
    expect(res).toHaveLength(1);
    // target defaulted to id (never a shared/undefined slot).
    expect((res[0].provider as unknown as { __target?: string }).__target).toBe(
      'wallet-no-target',
    );
  });

  it('an announce WITH an explicit target routes to that target', async () => {
    const stop = mockExtension([
      { id: 'wallet-y', name: 'Y', target: 'y-channel' },
    ]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0 });
    stop();
    expect((res[0].provider as unknown as { __target?: string }).__target).toBe(
      'y-channel',
    );
  });
});

// ── A2.1: identityResolved flag on discoverProviders entries ──────────────────

/** Bare slot: no sync id, status() resolves with NO provider.id (fast, unresolved). */
function barSlotNoIdentity(): CIP0103Provider {
  const p = {
    source: 'bareSlot',
    request: async () => ({}), // status() → {} → no provider.id
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as CIP0103Provider;
}

describe('A2.1 — identityResolved on discoverProviders entries', () => {
  it('injected slot with a SYNC provider.id → identityResolved true (id = real id)', async () => {
    setWindowCanton(mockProvider('sync-id'));
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    const entry = result.find((r) => r.id === 'sync-id')!; // rewritten to the real id
    expect(entry.identityResolved).toBe(true);
    expect(result.some((r) => r.id === 'canton')).toBe(false); // path id never surfaces
  });

  it('identity-less slot whose status() yields an id → identityResolved true (id = real id)', async () => {
    setWindowCanton(consoleLikeInjected('lpnf'));
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    const entry = result.find((r) => r.id === 'lpnf')!; // rewritten to the status id
    expect(entry.identityResolved).toBe(true);
    expect(result.some((r) => r.id === 'canton')).toBe(false);
  });

  it('identity-LESS bare slot (no id, no status id) → identityResolved FALSE (the phantom source)', async () => {
    setWindowCanton(barSlotNoIdentity());
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    const entry = result.find((r) => r.id === 'canton')!;
    expect(entry.identityResolved).toBe(false);
  });

  it('announce-discovered entries are ALWAYS identityResolved (announce id is the real id)', async () => {
    const stop = mockExtension([{ id: 'announced-x', name: 'X', target: 'announced-x' }]);
    const result = await discoverProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    const a = result.find((r) => r.id === 'announced-x');
    expect(a?.identityResolved).toBe(true);
  });
});
