/**
 * GenericAnnounceAdapter — opt-in capability config (Phase 1, additive).
 *
 * Proves: (a) NO config → byte-identical baseline (3 caps, minimal session, no
 * optional methods); (b) events → on()/off() bridges txChanged→txStatus + 'events'
 * cap; (c) restore → silent probe + party-match (+ expiry/mismatch → null);
 * (d) ledgerApi → standard call + 'ledgerApi' cap; (e) metadata populated when the
 * provider returns it, minimal when not; (f) mapError translates a configured
 * error, falls through otherwise. The optional methods are instance-assigned only
 * when configured, so feature-detection (`'x' in adapter`) stays honest.
 */
import { describe, it, expect, vi } from 'vitest';
import { toPartyId, toWalletId, type CIP0103Provider } from '@partylayer/core';
import { GenericAnnounceAdapter, type AnnounceAdapterConfig } from './announce-adapter';

type Handlers = Record<string, unknown>;

function mockProvider(handlers: Handlers = {}) {
  const bus = new Map<string, Set<(...a: unknown[]) => void>>();
  const provider = {
    request: vi.fn(async (args: { method: string }) => {
      const h = handlers[args.method];
      if (h && typeof h === 'object' && '__throw' in (h as object)) throw (h as { __throw: unknown }).__throw;
      return h;
    }) as CIP0103Provider['request'],
    on: vi.fn((event: string, listener: (...a: unknown[]) => void) => {
      let s = bus.get(event);
      if (!s) { s = new Set(); bus.set(event, s); }
      s.add(listener);
      return provider;
    }),
    emit: (event: string, ...a: unknown[]) => {
      bus.get(event)?.forEach((l) => l(...a));
      return true;
    },
    removeListener: vi.fn((event: string, listener: (...a: unknown[]) => void) => {
      bus.get(event)?.delete(listener);
      return provider;
    }),
  };
  return provider as unknown as CIP0103Provider & { emit: (e: string, ...a: unknown[]) => boolean };
}

const ctx = { network: 'canton:devnet' } as never;
const session = {} as never;
const ACCOUNT = {
  primary: true,
  partyId: 'party::gen-1',
  status: 'allocated',
  hint: 'gen',
  publicKey: 'PUBKEY',
  namespace: 'NS',
  networkId: 'canton:devnet',
  signingProviderId: 'webauthn-prf',
};

function make(config?: AnnounceAdapterConfig, handlers?: Handlers) {
  const provider = mockProvider({
    connect: { isConnected: true },
    getPrimaryAccount: ACCOUNT,
    status: { isConnected: true, network: { networkId: 'canton:devnet', ledgerApi: { baseUrl: 'https://api.example' } }, session: { userId: 'u1' } },
    disconnect: null,
    ...handlers,
  });
  const adapter = new GenericAnnounceAdapter({ announceId: 'genid', name: 'Gen', provider, config });
  return { adapter, provider };
}

describe('GenericAnnounceAdapter — opt-in config', () => {
  it('(a) NO config → byte-identical baseline (3 caps, minimal session, no optional methods)', async () => {
    const { adapter } = make();
    expect(adapter.getCapabilities()).toEqual(['connect', 'signMessage', 'submitTransaction']);
    expect(adapter.restore).toBeUndefined();
    expect(adapter.on).toBeUndefined();
    expect(adapter.ledgerApi).toBeUndefined();
    const res = await adapter.connect(ctx);
    expect(res.partyId).toEqual(toPartyId('party::gen-1'));
    expect(res.session.metadata).toBeUndefined(); // minimal session
    expect(res.session.walletId).toEqual(toWalletId('browser:ext:genid'));
  });

  it('(b) events → on()/off() bridges txChanged→txStatus, and "events" is a capability', async () => {
    const { adapter, provider } = make({ events: true });
    expect(adapter.getCapabilities()).toContain('events');
    expect(typeof adapter.on).toBe('function');

    const seen: unknown[] = [];
    const off = adapter.on!('txStatus', (p) => seen.push(p));
    (provider as { emit: (e: string, ...a: unknown[]) => boolean }).emit('txChanged', { status: 'executed', commandId: 'c1' });
    expect(seen).toEqual([{ status: 'committed', commandId: 'c1', raw: { status: 'executed', commandId: 'c1' } }]);

    off();
    (provider as { emit: (e: string, ...a: unknown[]) => boolean }).emit('txChanged', { status: 'failed', commandId: 'c2' });
    expect(seen).toHaveLength(1); // unsubscribed
  });

  it('(c) restore → silent probe + party-match; mismatch and expiry → null', async () => {
    const { adapter } = make({ restore: true });
    expect(adapter.getCapabilities()).toContain('restore');

    const ok = await adapter.restore!(ctx, { partyId: toPartyId('party::gen-1') } as never);
    expect(ok).not.toBeNull();
    expect(String((ok as { walletId: unknown }).walletId)).toBe('browser:ext:genid');

    const mismatch = await adapter.restore!(ctx, { partyId: toPartyId('party::other') } as never);
    expect(mismatch).toBeNull();

    const expired = await adapter.restore!(ctx, { partyId: toPartyId('party::gen-1'), expiresAt: 1 } as never);
    expect(expired).toBeNull();
  });

  it('(d) ledgerApi → standard call + result shaping, "ledgerApi" capability', async () => {
    const { adapter } = make({ ledgerApi: true }, { ledgerApi: { response: '{"ok":true}' } });
    expect(adapter.getCapabilities()).toContain('ledgerApi');
    const r = await adapter.ledgerApi!(ctx, session, { requestMethod: 'GET', resource: '/v2/state' });
    expect(r).toEqual({ response: '{"ok":true}' });
  });

  it('(e) metadata: populated when configured + provider returns it; minimal otherwise', async () => {
    const withMeta = await make({ metadata: true }).adapter.connect(ctx);
    expect(withMeta.session.metadata).toMatchObject({
      publicKey: 'PUBKEY', networkId: 'canton:devnet', ledgerApiBaseUrl: 'https://api.example', userId: 'u1',
    });
    const without = await make().adapter.connect(ctx);
    expect(without.session.metadata).toBeUndefined();
  });

  it('(f) mapError: translates a configured error, falls through otherwise', async () => {
    const mapError = (err: unknown) =>
      err instanceof Error && err.message === 'boom' ? new Error('MAPPED') : undefined;

    const boom = make({ mapError }, { connect: { __throw: new Error('boom') } }).adapter;
    await expect(boom.connect(ctx)).rejects.toThrow('MAPPED');

    const other = make({ mapError }, { connect: { __throw: new Error('different') } }).adapter;
    await expect(other.connect(ctx)).rejects.toThrow('different'); // fell through, original preserved
  });
});
