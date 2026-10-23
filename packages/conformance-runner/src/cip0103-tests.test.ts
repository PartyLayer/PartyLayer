import { describe, expect, it } from 'vitest';
import type { CIP0103Provider } from '@partylayer/core';
import { runCIP0103ConformanceTests } from './cip0103-tests';

describe('mandatory method evidence', () => {
  it.each([4200, -32601, 4900])('distinguishes unsupported mandatory methods from a disconnected supported method: %j', async code => {
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === 'getPrimaryAccount') throw Object.assign(new Error('Controlled provider response'), { code });
        if (method === 'connect') return { isConnected: true };
        if (method === '__cip0103_conformance_nonexistent__') throw Object.assign(new Error('Unsupported'), { code: 4200 });
        return undefined;
      },
      on: () => provider, removeListener: () => provider, emit: () => false,
    } as unknown as CIP0103Provider;
    const report = await runCIP0103ConformanceTests(provider);
    const method = report.results.find(result => result.name === 'Method "getPrimaryAccount" is handled');
    expect(method?.passed).toBe(code === 4900);
  });
});
