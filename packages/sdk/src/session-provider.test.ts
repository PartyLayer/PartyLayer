import { describe, expect, it, vi } from 'vitest';
import type { CIP0103Provider, CIP0103RequestPayload } from '@partylayer/core';
import { JSON_RPC_ERRORS, ProviderRpcError } from '@partylayer/provider';
import { createSessionProvider } from './session-provider';

function fixture() {
  function wallet(): CIP0103Provider {
    return {
      request: vi.fn(async () => ({ result: 'fixture' })),
      on: vi.fn().mockReturnThis(),
      emit: vi.fn().mockReturnValue(false),
      removeListener: vi.fn().mockReturnThis(),
    };
  }
  const bridge = wallet();
  const native = wallet();
  const getNative = vi.fn<[], CIP0103Provider | null>(() => null);
  const ensureSession = vi.fn(async () => undefined);
  const guardNetwork = vi.fn();
  const facade = createSessionProvider({
    bridge, native: getNative, ensureSession, guardNetwork,
    subscribe: vi.fn(() => () => {}),
  });
  // Construction observes no native wallet. Requests below can route to one,
  // without initial account/status reads obscuring their transport call counts.
  getNative.mockReturnValue(native);
  getNative.mockClear();
  return { ...facade, bridge, native, getNative, ensureSession, guardNetwork };
}

describe('session provider request validation', () => {
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
  ])('rejects $name before session or routing work', async ({ payload }) => {
    const f = fixture();
    try {
      const result = f.provider.request(payload as unknown as CIP0103RequestPayload);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toBeInstanceOf(ProviderRpcError);
      await expect(result).rejects.toMatchObject({
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: expect.stringMatching(/\S/),
      });
      expect(f.ensureSession).not.toHaveBeenCalled();
      expect(f.getNative).not.toHaveBeenCalled();
      expect(f.bridge.request).not.toHaveBeenCalled();
      expect(f.native.request).not.toHaveBeenCalled();
      expect(f.guardNetwork).not.toHaveBeenCalled();
    } finally { f.destroy(); }
  });

  for (const method of ['connect', 'status', 'ledgerApi', 'futureMethod']) {
    it.each([
      { name: 'null', params: null },
      { name: 'boolean', params: true },
      { name: 'number', params: 7 },
      { name: 'string', params: 'invalid' },
    ])(`rejects $name params for ${method} before session or routing work`, async ({ params }) => {
      const f = fixture();
      try {
        const result = f.provider.request({ method, params } as unknown as CIP0103RequestPayload);
        await expect(result).rejects.toBeInstanceOf(ProviderRpcError);
        await expect(result).rejects.toMatchObject({
          code: JSON_RPC_ERRORS.INVALID_PARAMS,
          message: expect.stringMatching(/\S/),
        });
        expect(f.ensureSession).not.toHaveBeenCalled();
        expect(f.getNative).not.toHaveBeenCalled();
        expect(f.bridge.request).not.toHaveBeenCalled();
        expect(f.native.request).not.toHaveBeenCalled();
        expect(f.guardNetwork).not.toHaveBeenCalled();
      } finally { f.destroy(); }
    });
  }

  it.each([
    { name: 'omitted params', payload: { method: 'futureMethod' } },
    { name: 'undefined params', payload: { method: 'futureMethod', params: undefined } },
    { name: 'object params', payload: { method: 'futureMethod', params: { enabled: true } } },
    { name: 'array params', payload: { method: 'futureMethod', params: ['value', 7] } },
    { name: 'empty method string', payload: { method: '' } },
  ])('forwards an unknown method with $name unchanged', async ({ payload }) => {
    const f = fixture();
    try {
      await expect(f.provider.request(payload)).resolves.toEqual({ result: 'fixture' });
      expect(f.ensureSession).toHaveBeenCalledOnce();
      expect(f.getNative).toHaveBeenCalledOnce();
      expect(f.native.request).toHaveBeenCalledOnce();
      expect(vi.mocked(f.native.request).mock.calls[0]?.[0]).toBe(payload);
      expect(f.bridge.request).not.toHaveBeenCalled();
      expect(f.guardNetwork).not.toHaveBeenCalled();
    } finally { f.destroy(); }
  });

  it.each(['connect', 'disconnect', 'signMessage'])('keeps valid %s on the compatibility bridge', async method => {
    const f = fixture();
    const payload = { method, params: { message: 'fixture' } };
    try {
      await f.provider.request(payload);
      expect(f.bridge.request).toHaveBeenCalledWith(payload);
      expect(f.ensureSession).not.toHaveBeenCalled();
      expect(f.getNative).not.toHaveBeenCalled();
      expect(f.native.request).not.toHaveBeenCalled();
      expect(f.guardNetwork).not.toHaveBeenCalled();
    } finally { f.destroy(); }
  });

  it.each(['getPrimaryAccount', 'listAccounts', 'status', 'ledgerApi', 'prepareExecute'])('preserves native %s routing and write guards', async method => {
    const f = fixture();
    const payload = { method, params: {} };
    try {
      await f.provider.request(payload);
      expect(f.ensureSession).toHaveBeenCalledOnce();
      expect(f.native.request).toHaveBeenCalledWith(payload);
      expect(f.bridge.request).not.toHaveBeenCalled();
      expect(f.guardNetwork).toHaveBeenCalledTimes(['ledgerApi', 'prepareExecute'].includes(method) ? 1 : 0);
    } finally { f.destroy(); }
  });

  it('retains bridge fallback when there is no native provider', async () => {
    const f = fixture();
    f.getNative.mockReturnValue(null);
    try {
      await f.provider.request({ method: 'status' });
      expect(f.ensureSession).toHaveBeenCalledOnce();
      expect(f.bridge.request).toHaveBeenCalledWith({ method: 'status' });
      expect(f.native.request).not.toHaveBeenCalled();
      expect(f.guardNetwork).not.toHaveBeenCalled();
    } finally { f.destroy(); }
  });
});
