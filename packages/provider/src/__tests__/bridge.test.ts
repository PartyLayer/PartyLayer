import { describe, it, expect, vi } from 'vitest';
import { createProviderBridge, type BridgeableClient } from '../bridge';
import { ProviderRpcError, RPC_ERRORS } from '../errors';
import { CIP0103_EVENTS } from '@partylayer/core';

function createMockClient(overrides: Partial<BridgeableClient> = {}): BridgeableClient {
  return {
    connect: vi.fn(async () => ({
      sessionId: 'sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-123' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage'],
    })),
    disconnect: vi.fn(async () => {}),
    getActiveSession: vi.fn(async () => ({
      sessionId: 'sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-123' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage'],
    })),
    signMessage: vi.fn(async () => ({
      signature: 'sig-abc' as unknown,
    })),
    signTransaction: vi.fn(async () => ({
      transactionHash: 'tx-hash-1' as unknown,
      signedTx: { encoded: 'signed-data' },
      partyId: 'party-123' as unknown,
    })),
    submitTransaction: vi.fn(async () => ({
      transactionHash: 'tx-hash-1' as unknown,
      submittedAt: Date.now(),
      commandId: 'cmd-1',
      updateId: 'update-1',
    })),
    ledgerApi: vi.fn(async () => ({
      response: JSON.stringify({ status: 'ok' }),
    })),
    getRegistryStatus: vi.fn(() => null),
    on: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe('createProviderBridge', () => {
  describe('interface shape', () => {
    it('should return a CIP-0103 Provider', () => {
      const provider = createProviderBridge(createMockClient());
      expect(typeof provider.request).toBe('function');
      expect(typeof provider.on).toBe('function');
      expect(typeof provider.emit).toBe('function');
      expect(typeof provider.removeListener).toBe('function');
    });

    it('on() should return provider for chaining', () => {
      const provider = createProviderBridge(createMockClient());
      const result = provider.on('test', () => {});
      expect(result).toBe(provider);
    });

    it('removeListener() should return provider for chaining', () => {
      const provider = createProviderBridge(createMockClient());
      const handler = () => {};
      provider.on('test', handler);
      const result = provider.removeListener('test', handler);
      expect(result).toBe(provider);
    });
  });

  describe('connect', () => {
    it('should return ConnectResult', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ isConnected: boolean }>({
        method: 'connect',
      });
      expect(result.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should call client.disconnect()', async () => {
      const client = createMockClient();
      const provider = createProviderBridge(client);
      await provider.request({ method: 'disconnect' });
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return isConnected true when session exists', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ isConnected: boolean }>({
        method: 'isConnected',
      });
      expect(result.isConnected).toBe(true);
    });

    it('should return isConnected false when no session', async () => {
      const client = createMockClient({
        getActiveSession: vi.fn(async () => null),
      });
      const provider = createProviderBridge(client);
      const result = await provider.request<{ isConnected: boolean }>({
        method: 'isConnected',
      });
      expect(result.isConnected).toBe(false);
    });
  });

  describe('status', () => {
    it('should return StatusEvent shape', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{
        connection: { isConnected: boolean };
        provider: { id: string };
        network: { networkId: string };
      }>({ method: 'status' });

      expect(result.connection.isConnected).toBe(true);
      expect(result.provider.id).toBe('partylayer');
      expect(result.network.networkId).toBe('canton:da-devnet');
    });
  });

  describe('getActiveNetwork', () => {
    it('should return CAIP-2 network', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ networkId: string }>({
        method: 'getActiveNetwork',
      });
      expect(result.networkId).toBe('canton:da-devnet');
    });
  });

  describe('listAccounts', () => {
    it('should return accounts array', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<Array<{ primary: boolean; partyId: string }>>({
        method: 'listAccounts',
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].primary).toBe(true);
      expect(result[0].partyId).toBe('party-123');
    });

    it('should return empty array when no session', async () => {
      const client = createMockClient({
        getActiveSession: vi.fn(async () => null),
      });
      const provider = createProviderBridge(client);
      const result = await provider.request<unknown[]>({
        method: 'listAccounts',
      });
      expect(result).toEqual([]);
    });
  });

  describe('getPrimaryAccount', () => {
    it('should return primary account', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ primary: boolean; partyId: string }>({
        method: 'getPrimaryAccount',
      });
      expect(result.primary).toBe(true);
      expect(result.partyId).toBe('party-123');
    });

    it('should throw DISCONNECTED when no session', async () => {
      const client = createMockClient({
        getActiveSession: vi.fn(async () => null),
      });
      const provider = createProviderBridge(client);

      try {
        await provider.request({ method: 'getPrimaryAccount' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect((err as ProviderRpcError).code).toBe(RPC_ERRORS.DISCONNECTED);
      }
    });
  });

  describe('signMessage', () => {
    it('should return signature string', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<string>({
        method: 'signMessage',
        params: { message: 'hello' },
      });
      expect(result).toBe('sig-abc');
    });
  });

  describe('prepareExecute', () => {
    it('should emit full tx lifecycle: pending -> signed -> executed', async () => {
      const provider = createProviderBridge(createMockClient());
      const handler = vi.fn();
      provider.on(CIP0103_EVENTS.TX_CHANGED, handler);

      await provider.request({
        method: 'prepareExecute',
        params: { tx: {} },
      });

      expect(handler).toHaveBeenCalledTimes(3);

      // First call: pending
      expect(handler.mock.calls[0][0]).toMatchObject({
        status: 'pending',
      });
      const commandId = handler.mock.calls[0][0].commandId;
      expect(typeof commandId).toBe('string');

      // Second call: signed
      expect(handler.mock.calls[1][0]).toMatchObject({
        status: 'signed',
        commandId,
        payload: {
          signature: expect.any(String),
          signedBy: 'party-123',
          party: 'party-123',
        },
      });

      // Third call: executed
      expect(handler.mock.calls[2][0]).toMatchObject({
        status: 'executed',
        commandId,
        payload: {
          updateId: 'update-1',
          completionOffset: 0,
        },
      });
    });

    it('should emit pending then failed when signTransaction fails', async () => {
      const client = createMockClient({
        signTransaction: vi.fn(async () => {
          throw new Error('user rejected');
        }),
      });
      const provider = createProviderBridge(client);
      const handler = vi.fn();
      provider.on(CIP0103_EVENTS.TX_CHANGED, handler);

      try {
        await provider.request({
          method: 'prepareExecute',
          params: { tx: {} },
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
      }

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].status).toBe('pending');
      expect(handler.mock.calls[1][0].status).toBe('failed');
    });

    it('should emit pending, signed, then failed when submitTransaction fails', async () => {
      const client = createMockClient({
        submitTransaction: vi.fn(async () => {
          throw new Error('submission error');
        }),
      });
      const provider = createProviderBridge(client);
      const handler = vi.fn();
      provider.on(CIP0103_EVENTS.TX_CHANGED, handler);

      try {
        await provider.request({
          method: 'prepareExecute',
          params: { tx: {} },
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
      }

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls[0][0].status).toBe('pending');
      expect(handler.mock.calls[1][0].status).toBe('signed');
      expect(handler.mock.calls[2][0].status).toBe('failed');
    });

    it('should use consistent commandId across all events', async () => {
      const provider = createProviderBridge(createMockClient());
      const handler = vi.fn();
      provider.on(CIP0103_EVENTS.TX_CHANGED, handler);

      await provider.request({
        method: 'prepareExecute',
        params: { tx: {} },
      });

      const commandId = handler.mock.calls[0][0].commandId;
      expect(handler.mock.calls[1][0].commandId).toBe(commandId);
      expect(handler.mock.calls[2][0].commandId).toBe(commandId);
    });
  });

  describe('ledgerApi', () => {
    it('should proxy ledgerApi request when client supports it', async () => {
      const provider = createProviderBridge(createMockClient());
      const result = await provider.request<{ response: string }>({
        method: 'ledgerApi',
        params: {
          requestMethod: 'GET',
          resource: '/v1/state/acs',
        },
      });
      expect(result.response).toBe(JSON.stringify({ status: 'ok' }));
    });

    it('forwards an OBJECT body to client.ledgerApi unchanged (never "[object Object]")', async () => {
      const client = createMockClient();
      const provider = createProviderBridge(client);
      await provider.request({
        method: 'ledgerApi',
        params: {
          requestMethod: 'post',
          resource: '/v2/state/active-contracts',
          body: { filter: { x: 1 } },
        },
      });
      // The bridge must NOT String() the body — the wallet's adapter normalizes.
      expect(client.ledgerApi).toHaveBeenCalledWith({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: { filter: { x: 1 } },
      });
    });

    it('forwards a STRING body + verb case to client.ledgerApi unchanged', async () => {
      const client = createMockClient();
      const provider = createProviderBridge(client);
      await provider.request({
        method: 'ledgerApi',
        params: {
          requestMethod: 'POST',
          resource: '/v2/state/active-contracts',
          body: '{"filter":{}}',
        },
      });
      expect(client.ledgerApi).toHaveBeenCalledWith({
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: '{"filter":{}}',
      });
    });

    it('should throw UNSUPPORTED_METHOD when client lacks ledgerApi', async () => {
      const client = createMockClient();
      delete (client as Record<string, unknown>).ledgerApi;
      const provider = createProviderBridge(client);
      try {
        await provider.request({ method: 'ledgerApi' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect((err as ProviderRpcError).code).toBe(RPC_ERRORS.UNSUPPORTED_METHOD);
      }
    });
  });

  describe('connected event', () => {
    it('should emit connected event on session:connected', () => {
      const handlers: Record<string, (event: unknown) => void> = {};
      const client = createMockClient({
        on: vi.fn((event: string, handler: (event: unknown) => void) => {
          handlers[event] = handler;
          return () => {};
        }),
      });
      const provider = createProviderBridge(client);
      const connectedHandler = vi.fn();
      provider.on(CIP0103_EVENTS.CONNECTED, connectedHandler);

      // Simulate session:connected event
      handlers['session:connected']?.({
        type: 'session:connected',
        session: {
          partyId: 'party-123',
          network: 'devnet',
        },
      });

      expect(connectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          isConnected: true,
        }),
      );
    });

    it('should emit statusChanged and accountsChanged alongside connected', () => {
      const handlers: Record<string, (event: unknown) => void> = {};
      const client = createMockClient({
        on: vi.fn((event: string, handler: (event: unknown) => void) => {
          handlers[event] = handler;
          return () => {};
        }),
      });
      const provider = createProviderBridge(client);

      const statusHandler = vi.fn();
      const accountsHandler = vi.fn();
      const connectedHandler = vi.fn();
      provider.on(CIP0103_EVENTS.STATUS_CHANGED, statusHandler);
      provider.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, accountsHandler);
      provider.on(CIP0103_EVENTS.CONNECTED, connectedHandler);

      handlers['session:connected']?.({
        type: 'session:connected',
        session: {
          partyId: 'party-456',
          network: 'testnet',
        },
      });

      expect(statusHandler).toHaveBeenCalledTimes(1);
      expect(accountsHandler).toHaveBeenCalledTimes(1);
      expect(connectedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsupported method', () => {
    it('should throw UNSUPPORTED_METHOD for unknown methods', async () => {
      const provider = createProviderBridge(createMockClient());
      try {
        await provider.request({ method: 'nonExistentMethod' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
        expect((err as ProviderRpcError).code).toBe(RPC_ERRORS.UNSUPPORTED_METHOD);
      }
    });
  });

  describe('error wrapping', () => {
    it('should wrap client errors as ProviderRpcError', async () => {
      const client = createMockClient({
        connect: vi.fn(async () => {
          throw new Error('connection refused');
        }),
      });
      const provider = createProviderBridge(client);

      try {
        await provider.request({ method: 'connect' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderRpcError);
      }
    });
  });
});
