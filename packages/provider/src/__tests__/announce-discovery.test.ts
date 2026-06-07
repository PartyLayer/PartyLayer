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

import { afterEach, describe, expect, it } from 'vitest';
import type { CIP0103Provider } from '@partylayer/core';
import {
  discoverAnnouncedProviders,
  discoverInjectedProviders,
  discoverProviders,
  isCIP0103Provider,
  type AnnouncedWallet,
} from '../discovery';

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
    // window.canton instance wins the dedup (discovery-path id is "canton").
    expect(consoleEntries[0].id).toBe('canton');
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
