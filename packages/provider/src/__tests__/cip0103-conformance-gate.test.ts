/**
 * CIP-0103 Conformance Gate — Zero-Tolerance CI Test
 *
 * This suite is intentionally strict and partially overlaps with cip0103-e2e.test.ts.
 * Its purpose is to act as a hard CI gate: if ANY test fails, CIP-0103 compliance
 * is broken and the build must not ship.
 *
 * Tests exact payload shapes matching the CIP-0103 discriminated unions.
 */

import { describe, it, expect, vi } from 'vitest';
import { createProviderBridge, type BridgeableClient } from '../bridge';
import { ProviderRpcError } from '../errors';
import { CIP0103_EVENTS, CIP0103_MANDATORY_METHODS } from '@partylayer/core';
import type {
  CIP0103Provider,
  CIP0103StatusEvent,
  CIP0103Account,
  CIP0103Network,
  CIP0103ConnectResult,
  CIP0103TxChangedEvent,
} from '@partylayer/core';

// ─── Mock Client ─────────────────────────────────────────────────────────────

function createMockClient(overrides: Partial<BridgeableClient> = {}): BridgeableClient {
  return {
    connect: vi.fn(async () => ({
      sessionId: 'sess-gate-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-gate-abc' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction', 'ledgerApi'],
    })),
    disconnect: vi.fn(async () => {}),
    getActiveSession: vi.fn(async () => ({
      sessionId: 'sess-gate-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-gate-abc' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction', 'ledgerApi'],
    })),
    signMessage: vi.fn(async () => ({
      signature: 'sig-gate-xyz' as unknown,
    })),
    signTransaction: vi.fn(async () => ({
      transactionHash: 'tx-gate-hash' as unknown,
      signedTx: { data: 'signed-payload' },
      partyId: 'party-gate-abc' as unknown,
    })),
    submitTransaction: vi.fn(async () => ({
      transactionHash: 'tx-gate-hash' as unknown,
      submittedAt: Date.now(),
      commandId: 'cmd-gate-1',
      updateId: 'update-gate-1',
    })),
    ledgerApi: vi.fn(async (params) => ({
      response: JSON.stringify({ method: params.requestMethod, resource: params.resource }),
    })),
    getRegistryStatus: vi.fn(() => null),
    on: vi.fn(() => () => {}),
    ...overrides,
  };
}

// ─── Provider Interface Contract ─────────────────────────────────────────────

describe('CIP-0103 Conformance Gate', () => {
  describe('GATE: Provider interface has exactly 4 required methods', () => {
    it('request, on, emit, removeListener are functions', () => {
      const p: CIP0103Provider = createProviderBridge(createMockClient());
      expect(typeof p.request).toBe('function');
      expect(typeof p.on).toBe('function');
      expect(typeof p.emit).toBe('function');
      expect(typeof p.removeListener).toBe('function');
    });

    it('on() and removeListener() return the provider instance (chaining)', () => {
      const p = createProviderBridge(createMockClient());
      const fn = () => {};
      expect(p.on('test', fn)).toBe(p);
      expect(p.removeListener('test', fn)).toBe(p);
    });
  });

  // ─── All 10 Mandatory Methods ──────────────────────────────────────────

  describe('GATE: All 10 mandatory methods are handled', () => {
    const provider = createProviderBridge(createMockClient());

    for (const method of CIP0103_MANDATORY_METHODS) {
      it(`"${method}" returns a result or ProviderRpcError (never a raw Error)`, async () => {
        try {
          const result = await provider.request({ method, params: {} });
          // Success — result must be defined (or undefined for disconnect/prepareExecute)
          expect(result !== 'UNHANDLED').toBe(true);
        } catch (err) {
          // Must be ProviderRpcError, not a raw Error
          expect(err).toBeInstanceOf(ProviderRpcError);
          expect(typeof (err as ProviderRpcError).code).toBe('number');
          expect(typeof (err as ProviderRpcError).message).toBe('string');
        }
      });
    }
  });

  // ─── Response Payload Shapes ───────────────────────────────────────────

  describe('GATE: Response payload shapes match CIP-0103 spec exactly', () => {
    it('connect → CIP0103ConnectResult { isConnected: boolean }', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103ConnectResult>({ method: 'connect' });
      expect(typeof result.isConnected).toBe('boolean');
      expect(result.isConnected).toBe(true);
    });

    it('isConnected → CIP0103ConnectResult { isConnected: boolean, reason?: string }', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103ConnectResult>({ method: 'isConnected' });
      expect(typeof result.isConnected).toBe('boolean');

      // When disconnected: reason must be a string
      const pDisc = createProviderBridge(createMockClient({ getActiveSession: vi.fn(async () => null) }));
      const disc = await pDisc.request<CIP0103ConnectResult>({ method: 'isConnected' });
      expect(disc.isConnected).toBe(false);
      expect(typeof disc.reason).toBe('string');
    });

    it('status → CIP0103StatusEvent with all required fields', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103StatusEvent>({ method: 'status' });

      // connection
      expect(typeof result.connection).toBe('object');
      expect(typeof result.connection.isConnected).toBe('boolean');

      // provider
      expect(typeof result.provider).toBe('object');
      expect(typeof result.provider.id).toBe('string');
      expect(typeof result.provider.version).toBe('string');
      expect(typeof result.provider.providerType).toBe('string');

      // network (when connected)
      expect(result.network).toBeDefined();
      expect(typeof result.network!.networkId).toBe('string');
      expect(result.network!.networkId).toMatch(/^canton:/);

      // session (when connected)
      expect(result.session).toBeDefined();
      expect(typeof result.session!.userId).toBe('string');
    });

    it('getActiveNetwork → CIP0103Network { networkId: string } in CAIP-2 format', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103Network>({ method: 'getActiveNetwork' });
      expect(typeof result.networkId).toBe('string');
      expect(result.networkId).toMatch(/^canton:da-/);
    });

    it('listAccounts → CIP0103Account[] with all required fields', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103Account[]>({ method: 'listAccounts' });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const account = result[0];
      expect(typeof account.primary).toBe('boolean');
      expect(typeof account.partyId).toBe('string');
      expect(['initializing', 'allocated']).toContain(account.status);
      expect(typeof account.hint).toBe('string');
      expect(typeof account.publicKey).toBe('string');
      expect(typeof account.namespace).toBe('string');
      expect(typeof account.networkId).toBe('string');
      expect(typeof account.signingProviderId).toBe('string');
    });

    it('getPrimaryAccount → single CIP0103Account', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<CIP0103Account>({ method: 'getPrimaryAccount' });
      expect(result.primary).toBe(true);
      expect(typeof result.partyId).toBe('string');
      expect(result.partyId.length).toBeGreaterThan(0);
    });

    it('signMessage → string signature', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<string>({ method: 'signMessage', params: { message: 'test' } });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('disconnect → undefined', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request({ method: 'disconnect' });
      expect(result).toBeUndefined();
    });
  });

  // ─── Transaction Lifecycle (Discriminated Union) ───────────────────────

  describe('GATE: Transaction lifecycle matches CIP-0103 txChanged discriminated union', () => {
    it('prepareExecute emits exactly 3 events: pending → signed → executed', async () => {
      const p = createProviderBridge(createMockClient());
      const events: CIP0103TxChangedEvent[] = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e as CIP0103TxChangedEvent));

      await p.request({ method: 'prepareExecute', params: { tx: { dummy: true } } });

      expect(events).toHaveLength(3);
      expect(events[0].status).toBe('pending');
      expect(events[1].status).toBe('signed');
      expect(events[2].status).toBe('executed');
    });

    it('pending event shape: { status: "pending", commandId: string }', async () => {
      const p = createProviderBridge(createMockClient());
      const events: unknown[] = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e));

      await p.request({ method: 'prepareExecute', params: { tx: {} } });

      const pending = events[0] as { status: string; commandId: string };
      expect(pending.status).toBe('pending');
      expect(typeof pending.commandId).toBe('string');
      expect(pending.commandId.length).toBeGreaterThan(0);
    });

    it('signed event shape: { status: "signed", commandId, payload: { signature, signedBy, party } }', async () => {
      const p = createProviderBridge(createMockClient());
      const events: unknown[] = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e));

      await p.request({ method: 'prepareExecute', params: { tx: {} } });

      const signed = events[1] as {
        status: string;
        commandId: string;
        payload: { signature: string; signedBy: string; party: string };
      };
      expect(signed.status).toBe('signed');
      expect(typeof signed.commandId).toBe('string');
      expect(typeof signed.payload).toBe('object');
      expect(typeof signed.payload.signature).toBe('string');
      expect(signed.payload.signature.length).toBeGreaterThan(0);
      expect(typeof signed.payload.signedBy).toBe('string');
      expect(typeof signed.payload.party).toBe('string');
    });

    it('executed event shape: { status: "executed", commandId, payload: { updateId, completionOffset } }', async () => {
      const p = createProviderBridge(createMockClient());
      const events: unknown[] = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e));

      await p.request({ method: 'prepareExecute', params: { tx: {} } });

      const executed = events[2] as {
        status: string;
        commandId: string;
        payload: { updateId: string; completionOffset: number };
      };
      expect(executed.status).toBe('executed');
      expect(typeof executed.commandId).toBe('string');
      expect(typeof executed.payload).toBe('object');
      expect(typeof executed.payload.updateId).toBe('string');
      expect(executed.payload.updateId).toBe('update-gate-1');
      expect(typeof executed.payload.completionOffset).toBe('number');
    });

    it('all events share the same commandId', async () => {
      const p = createProviderBridge(createMockClient());
      const events: Array<{ commandId: string }> = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e as { commandId: string }));

      await p.request({ method: 'prepareExecute', params: { tx: {} } });

      const cmdId = events[0].commandId;
      expect(events[1].commandId).toBe(cmdId);
      expect(events[2].commandId).toBe(cmdId);
    });

    it('sign failure: pending → failed (no signed event)', async () => {
      const client = createMockClient({
        signTransaction: vi.fn(async () => { throw new Error('user rejected'); }),
      });
      const p = createProviderBridge(client);
      const events: Array<{ status: string }> = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e as { status: string }));

      await expect(p.request({ method: 'prepareExecute', params: { tx: {} } })).rejects.toThrow();

      expect(events.map(e => e.status)).toEqual(['pending', 'failed']);
    });

    it('submit failure: pending → signed → failed', async () => {
      const client = createMockClient({
        submitTransaction: vi.fn(async () => { throw new Error('network error'); }),
      });
      const p = createProviderBridge(client);
      const events: Array<{ status: string }> = [];
      p.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e as { status: string }));

      await expect(p.request({ method: 'prepareExecute', params: { tx: {} } })).rejects.toThrow();

      expect(events.map(e => e.status)).toEqual(['pending', 'signed', 'failed']);
    });
  });

  // ─── Error Model ───────────────────────────────────────────────────────

  describe('GATE: Error model compliance', () => {
    it('all errors are ProviderRpcError with numeric code', async () => {
      const client = createMockClient({
        connect: vi.fn(async () => { throw new Error('generic failure'); }),
      });
      const p = createProviderBridge(client);

      try {
        await p.request({ method: 'connect' });
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        const rpcErr = err as ProviderRpcError;
        expect(typeof rpcErr.code).toBe('number');
        expect(typeof rpcErr.message).toBe('string');
      }
    });

    it('unsupported method → code 4200', async () => {
      const p = createProviderBridge(createMockClient());
      try {
        await p.request({ method: '__nonexistent__' });
        expect.fail('should throw');
      } catch (err) {
        expect((err as ProviderRpcError).code).toBe(4200);
      }
    });

    it('disconnected state → code 4900 for getPrimaryAccount', async () => {
      const p = createProviderBridge(createMockClient({ getActiveSession: vi.fn(async () => null) }));
      try {
        await p.request({ method: 'getPrimaryAccount' });
        expect.fail('should throw');
      } catch (err) {
        expect((err as ProviderRpcError).code).toBe(4900);
      }
    });
  });

  // ─── CIP-0103 Events ──────────────────────────────────────────────────

  describe('GATE: CIP-0103 events are correctly wired', () => {
    function createClientWithEvents(): {
      client: BridgeableClient;
      fire: (event: string, data: unknown) => void;
    } {
      const handlers: Record<string, (event: unknown) => void> = {};
      const client = createMockClient({
        on: vi.fn((event: string, handler: (event: unknown) => void) => {
          handlers[event] = handler;
          return () => {};
        }),
      });
      return {
        client,
        fire: (event, data) => handlers[event]?.(data),
      };
    }

    it('session:connected → statusChanged with correct shape', () => {
      const { client, fire } = createClientWithEvents();
      const p = createProviderBridge(client);
      const fn = vi.fn();
      p.on(CIP0103_EVENTS.STATUS_CHANGED, fn);

      fire('session:connected', {
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      const status = fn.mock.calls[0][0] as CIP0103StatusEvent;
      expect(status.connection.isConnected).toBe(true);
      expect(typeof status.provider.id).toBe('string');
      expect(typeof status.provider.version).toBe('string');
    });

    it('session:connected → accountsChanged with CIP0103Account[]', () => {
      const { client, fire } = createClientWithEvents();
      const p = createProviderBridge(client);
      const fn = vi.fn();
      p.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, fn);

      fire('session:connected', {
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      const accounts = fn.mock.calls[0][0] as CIP0103Account[];
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts[0].primary).toBe(true);
      expect(accounts[0].partyId).toBe('p1');
    });

    it('session:connected → connected event with { isConnected: true }', () => {
      const { client, fire } = createClientWithEvents();
      const p = createProviderBridge(client);
      const fn = vi.fn();
      p.on(CIP0103_EVENTS.CONNECTED, fn);

      fire('session:connected', {
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toMatchObject({ isConnected: true });
    });

    it('session:disconnected → statusChanged with isConnected: false', () => {
      const { client, fire } = createClientWithEvents();
      const p = createProviderBridge(client);
      const fn = vi.fn();
      p.on(CIP0103_EVENTS.STATUS_CHANGED, fn);

      fire('session:disconnected', { type: 'session:disconnected' });

      expect(fn).toHaveBeenCalledTimes(1);
      const status = fn.mock.calls[0][0] as CIP0103StatusEvent;
      expect(status.connection.isConnected).toBe(false);
    });
  });

  // ─── LedgerApi ─────────────────────────────────────────────────────────

  describe('GATE: ledgerApi handling', () => {
    it('proxies when client supports it', async () => {
      const p = createProviderBridge(createMockClient());
      const result = await p.request<{ response: string }>({
        method: 'ledgerApi',
        params: { requestMethod: 'GET', resource: '/v1/state/acs' },
      });
      expect(typeof result.response).toBe('string');
    });

    it('throws UNSUPPORTED_METHOD (4200) when client lacks ledgerApi', async () => {
      const client = createMockClient();
      delete (client as Record<string, unknown>).ledgerApi;
      const p = createProviderBridge(client);

      try {
        await p.request({ method: 'ledgerApi', params: { requestMethod: 'GET', resource: '/' } });
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect((err as ProviderRpcError).code).toBe(4200);
      }
    });
  });
});
