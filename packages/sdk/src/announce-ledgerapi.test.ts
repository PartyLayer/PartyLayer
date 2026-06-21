/**
 * ledgerApi wire-shape coverage for the SDK announce bridge.
 *
 * The GenericAnnounceAdapter is a CIP-0103 RPC wallet path, so its ledgerApi
 * must hand the provider a canonical request: a LOWER-case verb + an OBJECT
 * body. Regression guard so the normalization can't silently revert.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  CIP0103Provider,
  AdapterContext,
  Session,
} from '@partylayer/core';
import { GenericAnnounceAdapter } from './announce-adapter';

function spyProvider() {
  const request = vi.fn(async () => ({ response: 'ok' }));
  const provider = {
    request,
    on: () => () => {},
    emit: () => false,
    removeListener: () => {},
  } as unknown as CIP0103Provider;
  return { provider, request };
}

const ctx = {
  network: 'canton:mainnet',
  logger: { debug() {}, info() {}, warn() {}, error() {} },
} as unknown as AdapterContext;
const session = {} as Session;

function adapterWith(provider: CIP0103Provider) {
  return new GenericAnnounceAdapter({
    announceId: 'testkernelidaaaaaaaaaaaaaaaaaaaa',
    name: 'Test',
    provider,
    config: { ledgerApi: true },
  });
}

describe('GenericAnnounceAdapter ledgerApi normalization (CIP-0103: lower-case verb + OBJECT body)', () => {
  it('lower-cases the verb + parses a string body to an object on the wire', async () => {
    const { provider, request } = spyProvider();
    const adapter = adapterWith(provider);
    await adapter.ledgerApi!(ctx, session, {
      requestMethod: 'POST',
      resource: '/v2/state/active-contracts',
      body: '{"filter":{"x":1}}',
    });
    expect(request).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: { filter: { x: 1 } },
      },
    });
  });

  it('passes an object body through unchanged (lower-case verb)', async () => {
    const { provider, request } = spyProvider();
    const adapter = adapterWith(provider);
    const body = { filter: { y: 2 } };
    await adapter.ledgerApi!(ctx, session, {
      requestMethod: 'get',
      resource: '/v2/state/active-contracts',
      body,
    });
    expect(request).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        requestMethod: 'get',
        resource: '/v2/state/active-contracts',
        body,
      },
    });
  });
});
