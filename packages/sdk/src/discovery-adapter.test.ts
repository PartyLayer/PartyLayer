/**
 * GenericDiscoveryAdapter — hermetic bridge tests.
 *
 * A fake OfficialProviderAdapter backed by an EVENTLESS CIP0103Provider (the
 * on/emit/removeListener surface exists but never fires — the popup/remote
 * wallet shape, e.g. Walley). Verifies the bridge delegates correctly, never
 * claims `events`, derives the walletId from the provider id, and obtains the
 * official provider LAZILY (not at construction → SSR-safe).
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  AdapterContext,
  CIP0103Provider,
  OfficialProviderAdapter,
  Session,
} from '@partylayer/core';
import { toWalletId } from '@partylayer/core';
import { GenericDiscoveryAdapter } from './discovery-adapter';

/** Eventless CIP-0103 provider: methods present, emit never used. */
function makeEventlessProvider(handlers: Record<string, unknown>): CIP0103Provider {
  const provider: CIP0103Provider = {
    request: vi.fn(async (args: { method: string }) => handlers[args.method]) as CIP0103Provider['request'],
    on: () => provider,
    emit: () => false,
    removeListener: () => provider,
  };
  return provider;
}

function makeOfficial(
  over: Partial<OfficialProviderAdapter> = {},
  providerHandlers: Record<string, unknown> = {},
): { official: OfficialProviderAdapter; providerFactory: ReturnType<typeof vi.fn> } {
  const provider = makeEventlessProvider({
    connect: { isConnected: true, isNetworkConnected: true },
    getPrimaryAccount: { partyId: 'party::demo-1', networkId: 'canton:da-devnet' },
    status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    disconnect: null,
    signMessage: { signature: 'sig', message: 'm' },
    prepareExecute: { transactionHash: '0xabc' },
    ...providerHandlers,
  });
  const providerFactory = vi.fn(() => provider);
  const official: OfficialProviderAdapter = {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: providerFactory as unknown as OfficialProviderAdapter['provider'],
    ...over,
  };
  return { official, providerFactory };
}

const ctx = { network: 'canton:da-devnet' } as unknown as AdapterContext;
const session = {} as Session;

describe('GenericDiscoveryAdapter', () => {
  it('derives walletId from the provider id by default', () => {
    const { official } = makeOfficial();
    const a = new GenericDiscoveryAdapter({ official });
    expect(a.walletId).toBe(toWalletId('walley'));
    expect(a.name).toBe('Walley');
  });

  it('honors explicit walletId / name / icon overrides', () => {
    const { official } = makeOfficial();
    const a = new GenericDiscoveryAdapter({
      official,
      walletId: toWalletId('walley-custom'),
      name: 'Custom',
      icon: 'data:image/png;base64,xx',
    });
    expect(a.walletId).toBe(toWalletId('walley-custom'));
    expect(a.name).toBe('Custom');
    expect(a.icon).toBe('data:image/png;base64,xx');
  });

  it('NEVER reports the events capability', () => {
    const { official } = makeOfficial();
    const caps = new GenericDiscoveryAdapter({ official }).getCapabilities();
    expect(caps).not.toContain('events');
    expect(caps).toEqual(['connect', 'disconnect', 'signMessage', 'submitTransaction']);
  });

  it('does NOT call official.provider() at construction (SSR-safe / lazy)', () => {
    const { official, providerFactory } = makeOfficial();
    new GenericDiscoveryAdapter({ official });
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('detectInstalled delegates to official.detect()', async () => {
    const { official } = makeOfficial({ detect: vi.fn(async () => false) });
    const a = new GenericDiscoveryAdapter({ official });
    expect(await a.detectInstalled()).toEqual({
      installed: false,
      reason: 'Wallet reported not available',
    });
  });

  it('detectInstalled treats a throwing detect() as not-installed (no crash)', async () => {
    const { official } = makeOfficial({
      detect: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const a = new GenericDiscoveryAdapter({ official });
    expect(await a.detectInstalled()).toEqual({ installed: false, reason: 'Detection failed' });
  });

  it('connect delegates connect → getPrimaryAccount → status and builds the session', async () => {
    const { official, providerFactory } = makeOfficial();
    const a = new GenericDiscoveryAdapter({ official });
    const result = await a.connect(ctx);

    // provider() resolved lazily on first connect
    expect(providerFactory).toHaveBeenCalledTimes(1);
    const provider = providerFactory.mock.results[0].value as CIP0103Provider;
    const calls = (provider.request as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].method);
    expect(calls).toEqual(['connect', 'getPrimaryAccount', 'status']);

    expect(result.partyId).toBe('party::demo-1');
    expect(result.session.walletId).toBe(toWalletId('walley'));
    expect(result.session.network).toBe('canton:da-devnet');
    expect(result.capabilities).not.toContain('events');
  });

  it('connect falls back to ctx.network when status omits the network', async () => {
    const { official } = makeOfficial({}, {
      status: { connection: { isConnected: true } }, // no network
      getPrimaryAccount: { partyId: 'party::x' }, // no networkId
    });
    const a = new GenericDiscoveryAdapter({ official });
    const result = await a.connect({ network: 'canton:fallback' } as unknown as AdapterContext);
    expect(result.session.network).toBe('canton:fallback');
  });

  it('connect IGNORES an UNRECOGNIZED reported network and uses the recognized ctx.network (the Walley canton:unknown case)', async () => {
    // Walley devnet reports networkId "canton:unknown" via BOTH getPrimaryAccount
    // and status (observed live). An unrecognized report must NOT override the
    // dApp's recognized ctx.network — else session.network is uninterpretable and
    // the mismatch gate can't protect it.
    const { official } = makeOfficial({}, {
      getPrimaryAccount: { partyId: 'party::walley', networkId: 'canton:unknown' },
      status: { connection: { isConnected: true }, network: { networkId: 'canton:unknown' } },
    });
    const a = new GenericDiscoveryAdapter({ official });
    const result = await a.connect({ network: 'devnet' } as unknown as AdapterContext);
    expect(result.session.network).toBe('devnet'); // recognized ctx wins, NOT canton:unknown
  });

  it('signMessage and submitTransaction delegate to the provider', async () => {
    const { official, providerFactory } = makeOfficial();
    const a = new GenericDiscoveryAdapter({ official });
    await a.connect(ctx);
    const provider = providerFactory.mock.results[0].value as CIP0103Provider;
    const reqMock = provider.request as ReturnType<typeof vi.fn>;

    await a.signMessage(ctx, session, { message: 'hello' });
    expect(reqMock).toHaveBeenCalledWith({ method: 'signMessage', params: { message: 'hello' } });

    await a.submitTransaction(ctx, session, { signedTx: { foo: 1 } });
    expect(reqMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'prepareExecute' }),
    );
  });
});
