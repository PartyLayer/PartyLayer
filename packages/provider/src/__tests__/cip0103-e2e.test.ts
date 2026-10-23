/**
 * CIP-0103 End-to-End Compliance Test Suite
 *
 * Tests the bridge path (createProviderBridge) against the full
 * CIP-0103 specification: all 10 methods, all 4 events, full
 * transaction lifecycle, and error model.
 */

import { describe, it, expect, vi } from 'vitest';
import { createProviderBridge, type BridgeableClient } from '../bridge';
import { ProviderRpcError } from '../errors';
import { CIP0103_EVENTS, CIP0103_MANDATORY_METHODS } from '@partylayer/core';

function createMockClient(overrides: Partial<BridgeableClient> = {}): BridgeableClient {
  return {
    connect: vi.fn(async () => ({
      sessionId: 'sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-abc' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction', 'ledgerApi'],
    })),
    disconnect: vi.fn(async () => {}),
    getActiveSession: vi.fn(async () => ({
      sessionId: 'sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-abc' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction', 'ledgerApi'],
    })),
    signMessage: vi.fn(async () => ({
      signature: 'sig-xyz' as unknown,
    })),
    signTransaction: vi.fn(async () => ({
      signature: 'actual-signature-fixture',
      signedBy: 'party-abc',
      transactionHash: 'tx-e2e-1' as unknown,
      signedTx: { data: 'signed' },
      partyId: 'party-abc' as unknown,
    })),
    submitTransaction: vi.fn(async () => ({
      completionOffset: 37,
      transactionHash: 'tx-e2e-1' as unknown,
      submittedAt: Date.now(),
      commandId: 'cmd-e2e-1',
      updateId: 'update-e2e-1',
    })),
    ledgerApi: vi.fn(async (params) => ({
      response: JSON.stringify({ parties: ['party-abc'], method: params.requestMethod }),
    })),
    getRegistryStatus: vi.fn(() => null),
    on: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe('CIP-0103 E2E Compliance', () => {
  // ─── Provider Interface ──────────────────────────────────────────────

  describe('Provider interface shape', () => {
    it('has all 4 required interface methods', () => {
      const provider = createProviderBridge(createMockClient());
      expect(typeof provider.request).toBe('function');
      expect(typeof provider.on).toBe('function');
      expect(typeof provider.emit).toBe('function');
      expect(typeof provider.removeListener).toBe('function');
    });

    it('on() returns provider for chaining', () => {
      const provider = createProviderBridge(createMockClient());
      expect(provider.on('test', () => {})).toBe(provider);
    });

    it('removeListener() returns provider for chaining', () => {
      const provider = createProviderBridge(createMockClient());
      const fn = () => {};
      provider.on('test', fn);
      expect(provider.removeListener('test', fn)).toBe(provider);
    });

    it('emit() returns boolean', () => {
      const provider = createProviderBridge(createMockClient());
      expect(typeof provider.emit('test')).toBe('boolean');
    });
  });

  // ─── All 10 Mandatory Methods ────────────────────────────────────────

  describe('all 10 mandatory methods are handled', () => {
    for (const method of CIP0103_MANDATORY_METHODS) {
      it(`method "${method}" is handled (returns result or ProviderRpcError)`, async () => {
        const provider = createProviderBridge(createMockClient());
        try {
          await provider.request({ method, params: {} });
          // success = handled
        } catch (err) {
          // ProviderRpcError with numeric code = handled
          expect(err).toBeInstanceOf(ProviderRpcError);
          expect(typeof (err as ProviderRpcError).code).toBe('number');
        }
      });
    }
  });

  // ─── Full Transaction Lifecycle ──────────────────────────────────────

  describe('transaction lifecycle', () => {
    it('prepareExecute emits pending -> signed -> executed in order', async () => {
      const provider = createProviderBridge(createMockClient());
      const events: Array<{ status: string; commandId: string }> = [];
      provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => {
        events.push(e as { status: string; commandId: string });
      });

      await provider.request({ method: 'prepareExecute', params: { tx: { dummy: true } } });

      expect(events).toHaveLength(3);
      expect(events[0].status).toBe('pending');
      expect(events[1].status).toBe('signed');
      expect(events[2].status).toBe('executed');

      // All events share the same commandId
      const cmdId = events[0].commandId;
      expect(events[1].commandId).toBe(cmdId);
      expect(events[2].commandId).toBe(cmdId);
    });

    it('signed event has correct payload shape', async () => {
      const provider = createProviderBridge(createMockClient());
      const events: unknown[] = [];
      provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e));

      await provider.request({ method: 'prepareExecute', params: { tx: {} } });

      const signed = events[1] as {
        status: string;
        commandId: string;
        payload: { signature: string; signedBy: string; party: string };
      };
      expect(signed.status).toBe('signed');
      expect(typeof signed.payload.signature).toBe('string');
      expect(signed.payload.signature.length).toBeGreaterThan(0);
      expect(typeof signed.payload.signedBy).toBe('string');
      expect(typeof signed.payload.party).toBe('string');
    });

    it('executed event has correct payload shape', async () => {
      const provider = createProviderBridge(createMockClient());
      const events: unknown[] = [];
      provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => events.push(e));

      await provider.request({ method: 'prepareExecute', params: { tx: {} } });

      const executed = events[2] as {
        status: string;
        commandId: string;
        payload: { updateId: string; completionOffset: number };
      };
      expect(executed.status).toBe('executed');
      expect(typeof executed.payload.updateId).toBe('string');
      expect(executed.payload.updateId).toBe('update-e2e-1');
      expect(typeof executed.payload.completionOffset).toBe('number');
    });

    it('sign failure emits pending -> failed', async () => {
      const client = createMockClient({
        signTransaction: vi.fn(async () => { throw new Error('rejected'); }),
      });
      const provider = createProviderBridge(client);
      const events: Array<{ status: string }> = [];
      provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => {
        events.push(e as { status: string });
      });

      await expect(
        provider.request({ method: 'prepareExecute', params: { tx: {} } }),
      ).rejects.toThrow();

      expect(events.map((e) => e.status)).toEqual(['pending', 'failed']);
    });

    it('explicit submit rejection emits pending -> signed -> failed', async () => {
      const client = createMockClient({
        submitTransaction: vi.fn(async () => { throw Object.assign(new Error('user rejected'), { code: 4001 }); }),
      });
      const provider = createProviderBridge(client);
      const events: Array<{ status: string }> = [];
      provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => {
        events.push(e as { status: string });
      });

      await expect(
        provider.request({ method: 'prepareExecute', params: { tx: {} } }),
      ).rejects.toThrow();

      expect(events.map((e) => e.status)).toEqual(['pending', 'signed', 'failed']);
    });
  });

  // ─── Ledger API ──────────────────────────────────────────────────────

  describe('ledgerApi', () => {
    it('proxies GET request', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ response: string }>({
        method: 'ledgerApi',
        params: { requestMethod: 'GET', resource: '/v1/state/acs' },
      });
      expect(typeof result.response).toBe('string');
      const parsed = JSON.parse(result.response);
      expect(parsed.method).toBe('GET');
    });

    it('proxies POST request with body', async () => {
      const client = createMockClient({
        ledgerApi: vi.fn(async (params) => ({
          response: JSON.stringify({ received: params.body }),
        })),
      });
      const provider = createProviderBridge(client);
      const result = await provider.request<{ response: string }>({
        method: 'ledgerApi',
        params: { requestMethod: 'POST', resource: '/v1/commands', body: '{"command":"test"}' },
      });
      expect(JSON.parse(result.response).received).toBe('{"command":"test"}');
    });

    it('throws UNSUPPORTED_METHOD when adapter does not support it', async () => {
      const client = createMockClient();
      delete (client as Record<string, unknown>).ledgerApi;
      const provider = createProviderBridge(client);

      await expect(
        provider.request({ method: 'ledgerApi', params: { requestMethod: 'GET', resource: '/' } }),
      ).rejects.toMatchObject({ code: 4200 });
    });
  });

  // ─── Events ──────────────────────────────────────────────────────────

  describe('CIP-0103 events', () => {
    function createClientWithEventCapture(): {
      client: BridgeableClient;
      handlers: Record<string, (event: unknown) => void>;
    } {
      const handlers: Record<string, (event: unknown) => void> = {};
      const client = createMockClient({
        on: vi.fn((event: string, handler: (event: unknown) => void) => {
          handlers[event] = handler;
          return () => {};
        }),
      });
      return { client, handlers };
    }

    it('session:connected triggers statusChanged', () => {
      const { client, handlers } = createClientWithEventCapture();
      const provider = createProviderBridge(client);
      const fn = vi.fn();
      provider.on(CIP0103_EVENTS.STATUS_CHANGED, fn);

      handlers['session:connected']?.({
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toMatchObject({
        connection: { isConnected: true },
        provider: { id: 'partylayer' },
      });
    });

    it('session:connected triggers accountsChanged', () => {
      const { client, handlers } = createClientWithEventCapture();
      const provider = createProviderBridge(client);
      const fn = vi.fn();
      provider.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, fn);

      handlers['session:connected']?.({
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      const accounts = fn.mock.calls[0][0] as Array<{ partyId: string; primary: boolean }>;
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts[0].partyId).toBe('p1');
      expect(accounts[0].primary).toBe(true);
    });

    it('session:connected triggers connected event', () => {
      const { client, handlers } = createClientWithEventCapture();
      const provider = createProviderBridge(client);
      const fn = vi.fn();
      provider.on(CIP0103_EVENTS.CONNECTED, fn);

      handlers['session:connected']?.({
        type: 'session:connected',
        session: { partyId: 'p1', network: 'devnet' },
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toMatchObject({ isConnected: true });
    });

    it('session:disconnected triggers statusChanged with isConnected false', () => {
      const { client, handlers } = createClientWithEventCapture();
      const provider = createProviderBridge(client);
      const fn = vi.fn();
      provider.on(CIP0103_EVENTS.STATUS_CHANGED, fn);

      handlers['session:disconnected']?.({ type: 'session:disconnected' });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toMatchObject({
        connection: { isConnected: false },
      });
    });
  });

  // ─── Error Model ─────────────────────────────────────────────────────

  describe('error model', () => {
    it('unsupported method returns ProviderRpcError with code 4200', async () => {
      const provider = createProviderBridge(createMockClient());
      try {
        await provider.request({ method: '__nonexistent__' });
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect((err as ProviderRpcError).code).toBe(4200);
      }
    });

    it('all errors are ProviderRpcError instances', async () => {
      const client = createMockClient({
        connect: vi.fn(async () => { throw new Error('generic'); }),
      });
      const provider = createProviderBridge(client);
      try {
        await provider.request({ method: 'connect' });
        expect.fail('should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect(typeof (err as ProviderRpcError).code).toBe('number');
        expect(typeof (err as ProviderRpcError).message).toBe('string');
      }
    });
  });

  // ─── Connection Methods ──────────────────────────────────────────────

  describe('connection methods', () => {
    it('connect returns ConnectResult with isConnected: true', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ isConnected: boolean }>({ method: 'connect' });
      expect(result.isConnected).toBe(true);
    });

    it('disconnect returns undefined', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request({ method: 'disconnect' });
      expect(result).toBeUndefined();
    });

    it('isConnected returns false when no session', async () => {
      const client = createMockClient({ getActiveSession: vi.fn(async () => null) });
      const provider = createProviderBridge(client);
      const result = await provider.request<{ isConnected: boolean }>({ method: 'isConnected' });
      expect(result.isConnected).toBe(false);
    });
  });

  // ─── Status & Network ────────────────────────────────────────────────

  describe('status and network', () => {
    it('status returns full StatusEvent shape', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{
        connection: { isConnected: boolean };
        provider: { id: string; version: string; providerType: string };
        network: { networkId: string };
        session: { accessToken: string; userId: string };
      }>({ method: 'status' });

      expect(result.connection.isConnected).toBe(true);
      expect(result.provider.id).toBe('partylayer');
      expect(typeof result.provider.version).toBe('string');
      expect(result.network.networkId).toMatch(/^canton:/);
      expect(typeof result.session.userId).toBe('string');
    });

    it('getActiveNetwork returns CAIP-2 format', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ networkId: string }>({
        method: 'getActiveNetwork',
      });
      expect(result.networkId).toMatch(/^canton:da-/);
    });
  });

  // ─── Account Methods ─────────────────────────────────────────────────

  describe('account methods', () => {
    it('listAccounts returns array with correct shape', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<Array<{
        primary: boolean;
        partyId: string;
        status: string;
        hint: string;
        publicKey: string;
        namespace: string;
        networkId: string;
        signingProviderId: string;
      }>>({ method: 'listAccounts' });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      const account = result[0];
      expect(account.primary).toBe(true);
      expect(typeof account.partyId).toBe('string');
      expect(['initializing', 'allocated']).toContain(account.status);
      expect(typeof account.networkId).toBe('string');
    });

    it('getPrimaryAccount returns single account', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ primary: boolean; partyId: string }>({
        method: 'getPrimaryAccount',
      });
      expect(result.primary).toBe(true);
      expect(result.partyId).toBe('party-abc');
    });
  });
});
