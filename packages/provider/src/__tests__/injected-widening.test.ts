// @vitest-environment jsdom
/**
 * Injected-scan widening (G2a). The scan accepts extra window global paths so a
 * wallet at its own dedicated global (not the shared window.canton slot) can be
 * found, while the identity guard still holds: a widened slot whose identity
 * cannot be resolved is flagged so no picker entry is ever synthesized for it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { CIP0103Provider } from '@partylayer/core';
import { discoverInjectedProviders, discoverProviders, isCIP0103Provider } from '../discovery';

const DEDICATED = 'myWalletProvider';

/** Minimal CIP-0103 provider, optionally carrying a top-level id. */
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

/** Provider with a status() that yields a stable provider.id (identity resolves). */
function statusIdProvider(statusId: string): CIP0103Provider {
  const p = {
    request: async (args: { method: string }) =>
      args.method === 'status' ? { provider: { id: statusId } } : {},
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

function setGlobal(name: string, p: CIP0103Provider | undefined): void {
  const w = window as unknown as Record<string, unknown>;
  if (p) w[name] = p;
  else delete w[name];
}

afterEach(() => {
  setGlobal(DEDICATED, undefined);
  setGlobal('canton', undefined);
});

describe('discoverInjectedProviders — extra scan paths (G2a)', () => {
  it('does NOT find a dedicated global that is not in the built-in list (documents the gap)', () => {
    setGlobal(DEDICATED, mockProvider('wallet-id'));
    expect(discoverInjectedProviders().find((d) => d.id === DEDICATED)).toBeUndefined();
  });

  it('finds the dedicated global when it is passed as an extra scan path', () => {
    setGlobal(DEDICATED, mockProvider('wallet-id'));
    const found = discoverInjectedProviders([DEDICATED]).find((d) => d.id === DEDICATED);
    expect(found).toBeDefined();
    expect(isCIP0103Provider(found!.provider)).toBe(true);
  });

  it('no extra paths is byte-identical to the built-in scan', () => {
    setGlobal('canton', mockProvider('c'));
    expect(discoverInjectedProviders([]).map((d) => d.id)).toEqual(
      discoverInjectedProviders().map((d) => d.id),
    );
  });
});

describe('discoverProviders — identity guard holds for a widened path (G2a)', () => {
  it('a widened slot whose identity cannot be resolved is flagged identityResolved:false', async () => {
    setGlobal(DEDICATED, mockProvider()); // no top-level id, status() yields no provider.id
    const res = await discoverProviders({
      timeoutMs: 0,
      injectionPaths: [DEDICATED],
      createProvider: (a) => mockProvider(a.id),
    });
    const entry = res.find((d) => d.id === DEDICATED);
    expect(entry).toBeDefined();
    expect(entry!.identityResolved).toBe(false);
  });

  it('a widened slot with a resolvable status().provider.id is flagged identityResolved:true with the real id', async () => {
    setGlobal(DEDICATED, statusIdProvider('real-id'));
    const res = await discoverProviders({
      timeoutMs: 0,
      injectionPaths: [DEDICATED],
      createProvider: (a) => mockProvider(a.id),
    });
    const entry = res.find((d) => d.id === 'real-id');
    expect(entry).toBeDefined();
    expect(entry!.identityResolved).toBe(true);
  });
});
