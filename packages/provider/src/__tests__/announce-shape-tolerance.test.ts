// @vitest-environment jsdom
/**
 * Announce id-shape tolerance and the unusable-announce diagnostic (G2b). The id
 * is the first non-empty string among providerId, id, info.uuid, info.rdns; an
 * announce with no readable id is ignored (never trusted), and in development a
 * warning fires once per distinct offending event shape without throwing or
 * blocking discovery.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CIP0103Provider } from '@partylayer/core';
import { discoverAnnouncedProviders, type AnnouncedWallet } from '../discovery';

const ANNOUNCE_EVENT = 'canton:announceProvider';
const REQUEST_EVENT = 'canton:requestProvider';

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

const resolveMock = (a: AnnouncedWallet): CIP0103Provider => mockProvider(a.id);

describe('announce id-shape tolerance (G2b)', () => {
  it('consumes an EIP-6963-style announce whose id is at detail.info.uuid, with name from info', async () => {
    const stop = mockExtension([{ info: { uuid: 'walletish', name: 'From Info', rdns: 'org.x' } }]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    expect(res.map((r) => r.id)).toEqual(['walletish']);
    expect(res[0].name).toBe('From Info');
  });

  it('id precedence: providerId beats id beats info.uuid beats info.rdns', async () => {
    const stop = mockExtension([{ providerId: 'A', id: 'B', info: { uuid: 'C', rdns: 'D' } }]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    expect(res.map((r) => r.id)).toEqual(['A']);
  });

  it('falls to info.rdns when nothing else is a non-empty string', async () => {
    const stop = mockExtension([{ info: { rdns: 'org.example.wallet' } }]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();
    expect(res.map((r) => r.id)).toEqual(['org.example.wallet']);
  });
});

describe('unusable-announce diagnostic (G2b)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once per distinct offending event shape, never throws or blocks discovery', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Two announces of the SAME unreadable shape plus one good one.
    const stop = mockExtension([{ zzq: 1 }, { zzq: 2 }, { providerId: 'good' }]);
    const res = await discoverAnnouncedProviders({ timeoutMs: 0, createProvider: resolveMock });
    stop();

    // Discovery still returns the good wallet: not blocked, no throw.
    expect(res.map((r) => r.id)).toEqual(['good']);
    // Deduped to a single warning for the repeated unreadable shape.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('no readable provider id');
    expect(String(warn.mock.calls[0][0])).toContain('https://partylayer.xyz/docs/generic-bridge');
  });
});
