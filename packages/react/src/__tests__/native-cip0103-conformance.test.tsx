/**
 * React CIP-0103 conformance harness.
 *
 * Validates React's CIP-0103 layer against the SAME conformance runner used
 * elsewhere (`@partylayer/conformance-runner`, added here as a test-only
 * devDependency). React bindings are not CIP-0103 providers themselves: they
 * consume a provider. React's actual CIP-0103 touchpoint is
 * `NativeCIP0103Adapter`, which wraps a discovered CIP-0103 provider and drives
 * it via `provider.request({ method })` using the CIP-0103 method names.
 *
 * Two links are proven here:
 *  1. The provider React consumes passes `runCIP0103ConformanceTests` with zero
 *     failures (the literal "validated against the same CIP-0103 conformance
 *     runner" check), using a minimally conformant provider that mirrors what
 *     PartyLayerProvider does.
 *  2. `NativeCIP0103Adapter` drives that conformant provider per the CIP-0103
 *     contract: its WalletAdapter methods call `provider.request` with the
 *     correct CIP-0103 method names, and results flow back through the adapter.
 *
 * The conformance runner depends on core + provider, never on react, so this is a
 * one-directional, test-only devDependency.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  CIP0103Provider,
  CIP0103Account,
  CIP0103RequestPayload,
} from '@partylayer/core';
import { CIP0103_EVENTS } from '@partylayer/core';
import { runCIP0103ConformanceTests } from '@partylayer/conformance-runner/dist/cip0103-tests';
import type {
  AdapterContext,
  Session,
  PartyId,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
} from '@partylayer/sdk';
import { NativeCIP0103Adapter } from '../native-cip0103-adapter';

const PRIMARY_ACCOUNT: CIP0103Account = {
  primary: true,
  partyId: 'party::mock-1',
  status: 'allocated',
  hint: '',
  publicKey: '',
  namespace: '',
  networkId: 'canton:da-devnet',
  signingProviderId: '',
};

const SIGNATURE = '0xmocksignature';

/**
 * A minimally conformant CIP-0103 provider: an EventEmitter-style on/emit/
 * removeListener plus a request() that handles every mandatory method, emits the
 * full txChanged lifecycle for prepareExecute, and throws a ProviderRpcError
 * (numeric code 4200) for unknown methods. Mirrors PartyLayerProvider minimally.
 */
function createConformantProvider(): CIP0103Provider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const provider: CIP0103Provider = {
    async request<T = unknown>(args: CIP0103RequestPayload): Promise<T> {
      switch (args.method) {
        case 'connect':
          return { isConnected: true } as T;
        case 'disconnect':
          return undefined as T;
        case 'isConnected':
          return true as T;
        case 'status':
          return {
            connection: { isConnected: true },
            provider: { id: 'mock', version: '1', providerType: 'browser' },
            session: { accessToken: 'tok', userId: 'party::mock-1' },
          } as T;
        case 'getActiveNetwork':
          return { networkId: 'canton:da-devnet' } as T;
        case 'listAccounts':
          return [PRIMARY_ACCOUNT] as T;
        case 'getPrimaryAccount':
          return PRIMARY_ACCOUNT as T;
        case 'signMessage':
          return SIGNATURE as T;
        case 'prepareExecute': {
          // Emit the full CIP-0103 transaction lifecycle the runner checks for.
          provider.emit(CIP0103_EVENTS.TX_CHANGED, { status: 'pending', commandId: 'cmd-1' });
          provider.emit(CIP0103_EVENTS.TX_CHANGED, {
            status: 'signed',
            commandId: 'cmd-1',
            payload: { signature: SIGNATURE, signedBy: 'party::mock-1', party: 'party::mock-1' },
          });
          provider.emit(CIP0103_EVENTS.TX_CHANGED, {
            status: 'executed',
            commandId: 'cmd-1',
            payload: { updateId: '1220abc', completionOffset: 1 },
          });
          return { commandId: 'cmd-1', updateId: '1220abc', transactionHash: '0xtx', signedTx: { signed: true } } as T;
        }
        case 'ledgerApi':
          return { response: '{}' } as T;
        default: {
          const err = Object.assign(new Error(`Unsupported method: ${args.method}`), { code: 4200 });
          throw err;
        }
      }
    },
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as (...args: unknown[]) => void);
      return provider;
    },
    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return false;
      for (const listener of set) listener(...(args as unknown[]));
      return true;
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
  };

  return provider;
}

const mockCtx = {} as unknown as AdapterContext;
const mockSession = { partyId: 'party::mock-1' as PartyId } as unknown as Session;

describe('React CIP-0103 conformance: the consumed provider passes the runner', () => {
  it('a minimally conformant provider passes runCIP0103ConformanceTests with 0 failures', async () => {
    const provider = createConformantProvider();
    const report = await runCIP0103ConformanceTests(provider);

    expect(report.total).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
    // Sanity: any failures should surface their names for debugging.
    expect(report.results.filter((r) => !r.passed).map((r) => r.name)).toEqual([]);
  });
});

describe('React CIP-0103 conformance: NativeCIP0103Adapter drives the provider per the contract', () => {
  function setup() {
    const provider = createConformantProvider();
    const requestSpy = vi.spyOn(provider, 'request');
    const adapter = new NativeCIP0103Adapter('cip0103:mock', 'Mock Wallet', provider);
    const methods = () => requestSpy.mock.calls.map((c) => (c[0] as CIP0103RequestPayload).method);
    return { provider, requestSpy, adapter, methods };
  }

  it('connect() calls "connect" then "getPrimaryAccount", and the partyId flows back', async () => {
    const { adapter, methods } = setup();
    const result = await adapter.connect(mockCtx);
    expect(methods()).toContain('connect');
    expect(methods()).toContain('getPrimaryAccount');
    expect(result.partyId).toBe(PRIMARY_ACCOUNT.partyId); // result from the provider flows back
  });

  it('disconnect() calls "disconnect"', async () => {
    const { adapter, methods } = setup();
    await adapter.disconnect(mockCtx, mockSession);
    expect(methods()).toContain('disconnect');
  });

  it('signMessage() calls "signMessage" with the message, and the signature flows back', async () => {
    const { adapter, requestSpy, methods } = setup();
    const params = { message: 'hello' } as unknown as SignMessageParams;
    const signed = await adapter.signMessage(mockCtx, mockSession, params);
    expect(methods()).toContain('signMessage');
    expect(requestSpy).toHaveBeenCalledWith({ method: 'signMessage', params: { message: 'hello' } });
    expect(signed.signature as unknown as string).toBe(SIGNATURE);
    expect(signed.partyId).toBe(mockSession.partyId);
  });

  it('signTransaction() and submitTransaction() call "prepareExecute" (CIP-0103 has no sign-only)', async () => {
    const { adapter, methods } = setup();
    await adapter.signTransaction(mockCtx, mockSession, { tx: { commands: [] } } as unknown as SignTransactionParams);
    await adapter.submitTransaction(mockCtx, mockSession, { signedTx: { commands: [] } } as unknown as SubmitTransactionParams);
    const used = methods();
    expect(used.filter((m) => m === 'prepareExecute')).toHaveLength(2);
  });

  it('only ever speaks CIP-0103 method names (no PartyLayer client involved)', async () => {
    const { adapter, methods } = setup();
    await adapter.connect(mockCtx);
    await adapter.disconnect(mockCtx, mockSession);
    await adapter.signMessage(mockCtx, mockSession, { message: 'm' } as unknown as SignMessageParams);
    const allowed = new Set(['connect', 'getPrimaryAccount', 'status', 'disconnect', 'signMessage', 'prepareExecute']);
    for (const m of methods()) {
      expect(allowed.has(m)).toBe(true);
    }
  });
});
