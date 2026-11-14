import { describe, expect, it, vi } from 'vitest';
import type { CIP0103Provider, CIP0103RequestPayload } from '@partylayer/core';
import { JSON_RPC_ERRORS, ProviderRpcError } from '../errors';
import { MethodRouter } from '../method-router';
import { createProviderBridge, type BridgeableClient } from '../bridge';
import { PartyLayerProvider } from '../provider';

const entryPoints = [
  {
    name: 'createProviderBridge.request',
    forwardsUnknown: false,
    create(wallet: CIP0103Provider) {
      const client: BridgeableClient = {
        connect: vi.fn(), disconnect: vi.fn(),
        getActiveSession: vi.fn(async () => { await wallet.request({ method: 'status' }); return null; }),
        signMessage: vi.fn(), signTransaction: vi.fn(), submitTransaction: vi.fn(),
        getRegistryStatus: vi.fn(), on: vi.fn(() => () => {}),
      };
      const bridge = createProviderBridge(client);
      return (payload: CIP0103RequestPayload) => bridge.request(payload);
    },
  },
  {
    name: 'MethodRouter.route',
    forwardsUnknown: true,
    create(wallet: CIP0103Provider) {
      const router = new MethodRouter();
      router.setWalletProvider(wallet);
      return (payload: CIP0103RequestPayload) => router.route(payload);
    },
  },
  {
    name: 'PartyLayerProvider.request',
    forwardsUnknown: true,
    create(wallet: CIP0103Provider) {
      const provider = new PartyLayerProvider({
        walletProvider: { id: 'fixture', source: 'injected', provider: wallet },
      });
      return (payload: CIP0103RequestPayload) => provider.request(payload);
    },
  },
];

for (const entry of entryPoints) {
  describe(`${entry.name} request validation`, () => {
    function fixture() {
      const wallet: CIP0103Provider = {
        request: vi.fn(async () => 'wallet-result'),
        on: vi.fn().mockReturnThis(),
        emit: vi.fn().mockReturnValue(false),
        removeListener: vi.fn().mockReturnThis(),
      };
      return { wallet, request: entry.create(wallet) };
    }

    it.each([
      { name: 'undefined', payload: undefined },
      { name: 'null', payload: null },
      { name: 'boolean', payload: false },
      { name: 'number', payload: 7 },
      { name: 'string', payload: 'status' },
      { name: 'array', payload: [] },
      { name: 'missing method', payload: {} },
      { name: 'undefined method', payload: { method: undefined } },
      { name: 'null method', payload: { method: null } },
      { name: 'numeric method', payload: { method: 7 } },
      { name: 'object method', payload: { method: {} } },
    ])('rejects $name with INVALID_REQUEST before calling the wallet', async ({ payload }) => {
      const { wallet, request } = fixture();
      const result = request(payload as unknown as CIP0103RequestPayload);
      await expect(result).rejects.toBeInstanceOf(ProviderRpcError);
      await expect(result).rejects.toMatchObject({
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: expect.stringMatching(/\S/),
      });
      expect(wallet.request).not.toHaveBeenCalled();
    });

    for (const method of ['status', 'futureWalletMethod']) {
      it.each([
        { name: 'null', params: null },
        { name: 'boolean', params: true },
        { name: 'number', params: 7 },
        { name: 'string', params: 'invalid' },
      ])(`rejects $name params for ${method} before calling the wallet`, async ({ params }) => {
        const { wallet, request } = fixture();
        const result = request({ method, params } as unknown as CIP0103RequestPayload);
        await expect(result).rejects.toBeInstanceOf(ProviderRpcError);
        await expect(result).rejects.toMatchObject({
          code: JSON_RPC_ERRORS.INVALID_PARAMS,
          message: expect.stringMatching(/\S/),
        });
        expect(wallet.request).not.toHaveBeenCalled();
      });
    }

    if (!entry.forwardsUnknown) it.each([undefined, {}, []])(
      'accepts valid status params %j through the compatibility bridge', async (params) => {
        const { wallet, request } = fixture();
        await expect(request({ method: 'status', params })).resolves.toMatchObject({
          connection: { isConnected: false },
        });
        expect(wallet.request).toHaveBeenCalledOnce();
      },
    );

    if (entry.forwardsUnknown) it.each([
      { name: 'omitted params', payload: { method: 'futureWalletMethod' } },
      { name: 'undefined params', payload: { method: 'futureWalletMethod', params: undefined } },
      { name: 'object params', payload: { method: 'futureWalletMethod', params: { enabled: true } } },
      { name: 'array params', payload: { method: 'futureWalletMethod', params: ['value', 7] } },
      { name: 'empty method string', payload: { method: '' } },
    ])('forwards unknown method with $name unchanged', async ({ payload }) => {
      const { wallet, request } = fixture();
      await expect(request(payload)).resolves.toBe('wallet-result');
      expect(wallet.request).toHaveBeenCalledOnce();
      expect(vi.mocked(wallet.request).mock.calls[0]?.[0]).toBe(payload);
    });
  });
}
