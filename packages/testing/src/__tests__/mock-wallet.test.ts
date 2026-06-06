/**
 * Meta-tests: the mock wallet honors each configured scenario, with error
 * codes drawn from the repo's existing error model (no invented codes), and
 * scenarios are toggleable per-method.
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderRpcError,
  RPC_ERRORS,
  JSON_RPC_ERRORS,
} from '@partylayer/provider';
import { createMockWallet, type MockMethod } from '../mock-wallet';
import { MOCK_SCENARIO_NAMES, type MockScenarioName } from '../scenarios';

/** Expected code for each built-in scenario — all are pre-existing codes. */
const EXPECTED_CODE: Record<MockScenarioName, number> = {
  userRejected: RPC_ERRORS.USER_REJECTED, // 4001
  insufficientTraffic: JSON_RPC_ERRORS.RESOURCE_UNAVAILABLE, // -32002
  synchronizerError: RPC_ERRORS.CHAIN_DISCONNECTED, // 4901
  transactionTimeout: JSON_RPC_ERRORS.TRANSACTION_REJECTED, // -32003
  genericError: JSON_RPC_ERRORS.INTERNAL_ERROR, // -32603
};

async function expectRpcCode(promise: Promise<unknown>, code: number): Promise<void> {
  try {
    await promise;
    throw new Error('expected the request to reject');
  } catch (err) {
    expect(err).toBeInstanceOf(ProviderRpcError);
    expect((err as ProviderRpcError).code).toBe(code);
  }
}

describe('createMockWallet — scenarios', () => {
  it('the meta-test code table covers every built-in scenario name', () => {
    expect(new Set(Object.keys(EXPECTED_CODE))).toEqual(new Set(MOCK_SCENARIO_NAMES));
  });

  describe('each scenario surfaces its existing error code on connect', () => {
    for (const name of MOCK_SCENARIO_NAMES) {
      it(`${name} → code ${EXPECTED_CODE[name]}`, async () => {
        const provider = createMockWallet({ scenarios: { connect: name } });
        await expectRpcCode(provider.request({ method: 'connect' }), EXPECTED_CODE[name]);
      });
    }
  });

  it('happy config: connect resolves { isConnected: true }', async () => {
    const provider = createMockWallet();
    const result = await provider.request<{ isConnected: boolean }>({ method: 'connect' });
    expect(result.isConnected).toBe(true);
  });

  it('scenarios are per-method: connect succeeds while submission fails', async () => {
    const provider = createMockWallet({
      scenarios: { submitTransaction: 'synchronizerError' },
    });
    // connect works …
    const connected = await provider.request<{ isConnected: boolean }>({ method: 'connect' });
    expect(connected.isConnected).toBe(true);
    // … but the submission inside prepareExecute fails with the chain code.
    await expectRpcCode(
      provider.request({ method: 'prepareExecute', params: { tx: {} } }),
      RPC_ERRORS.CHAIN_DISCONNECTED,
    );
  });

  it('signMessage scenario surfaces userRejected (4001)', async () => {
    const provider = createMockWallet({ scenarios: { signMessage: 'userRejected' } });
    await expectRpcCode(
      provider.request({ method: 'signMessage', params: { message: 'hi' } }),
      RPC_ERRORS.USER_REJECTED,
    );
  });

  it('accepts a raw ProviderRpcError as a scenario (custom existing code)', async () => {
    const custom = new ProviderRpcError('boom', JSON_RPC_ERRORS.RATE_LIMIT_EXCEEDED);
    const provider = createMockWallet({ scenarios: { connect: custom } });
    await expectRpcCode(
      provider.request({ method: 'connect' }),
      JSON_RPC_ERRORS.RATE_LIMIT_EXCEEDED,
    );
  });

  it('accepts a { code, message } scenario', async () => {
    const provider = createMockWallet({
      scenarios: { connect: { code: RPC_ERRORS.UNAUTHORIZED, message: 'nope' } },
    });
    await expectRpcCode(provider.request({ method: 'connect' }), RPC_ERRORS.UNAUTHORIZED);
  });

  it('unsupported methods still return the standard 4200 code', async () => {
    const provider = createMockWallet();
    await expectRpcCode(
      provider.request({ method: '__does_not_exist__' }),
      RPC_ERRORS.UNSUPPORTED_METHOD,
    );
  });

  it('per-method delays are applied (fake timers)', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      const provider = createMockWallet({ delays: { connect: 1000 } });
      const pending = provider.request<{ isConnected: boolean }>({ method: 'connect' });
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(500);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      const result = await pending;
      expect(result.isConnected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('every MockMethod is a valid scenario target (type/shape sanity)', () => {
    const methods: MockMethod[] = [
      'connect',
      'disconnect',
      'getActiveSession',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
    ];
    for (const m of methods) {
      const provider = createMockWallet({ scenarios: { [m]: 'genericError' } });
      expect(typeof provider.request).toBe('function');
    }
  });
});
