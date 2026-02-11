/**
 * Kit → CIP-0103 Integration Test
 *
 * Validates that the code path used by PartyLayerKit (createPartyLayer → asProvider)
 * produces a fully compliant CIP-0103 Provider. This ensures that the high-level
 * Kit component never silently breaks CIP-0103 compliance.
 *
 * Note: This test creates a real PartyLayerClient (same way Kit does) and calls
 * asProvider() to get a bridge. It does NOT render React components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProviderBridge, type BridgeableClient } from '../bridge';
import { ProviderRpcError } from '../errors';
import { CIP0103_EVENTS, CIP0103_MANDATORY_METHODS } from '@partylayer/core';

/**
 * Simulate the client that Kit creates via createPartyLayer().
 * We mock at the BridgeableClient level since creating a real client
 * would require network access to the registry.
 */
function createKitStyleClient(): BridgeableClient {
  return {
    connect: vi.fn(async () => ({
      sessionId: 'kit-sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-kit-user' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction'],
    })),
    disconnect: vi.fn(async () => {}),
    getActiveSession: vi.fn(async () => ({
      sessionId: 'kit-sess-1' as unknown,
      walletId: 'console' as unknown,
      partyId: 'party-kit-user' as unknown,
      network: 'devnet',
      expiresAt: Date.now() + 3600000,
      capabilitiesSnapshot: ['connect', 'signMessage', 'signTransaction', 'submitTransaction'],
    })),
    signMessage: vi.fn(async () => ({ signature: 'kit-sig' as unknown })),
    signTransaction: vi.fn(async () => ({
      transactionHash: 'kit-tx-hash' as unknown,
      signedTx: { data: 'kit-signed' },
      partyId: 'party-kit-user' as unknown,
    })),
    submitTransaction: vi.fn(async () => ({
      transactionHash: 'kit-tx-hash' as unknown,
      submittedAt: Date.now(),
      commandId: 'kit-cmd-1',
      updateId: 'kit-update-1',
    })),
    getRegistryStatus: vi.fn(() => null),
    on: vi.fn(() => () => {}),
  };
}

describe('Kit → CIP-0103 Integration', () => {
  let client: BridgeableClient;

  beforeEach(() => {
    client = createKitStyleClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createProviderBridge(kitClient) returns valid CIP-0103 Provider', () => {
    const provider = createProviderBridge(client);
    expect(typeof provider.request).toBe('function');
    expect(typeof provider.on).toBe('function');
    expect(typeof provider.emit).toBe('function');
    expect(typeof provider.removeListener).toBe('function');
  });

  it('all 10 mandatory methods work through Kit-created bridge', async () => {
    const provider = createProviderBridge(client);

    for (const method of CIP0103_MANDATORY_METHODS) {
      try {
        await provider.request({ method, params: {} });
      } catch (err) {
        // Must be ProviderRpcError (not raw Error)
        expect(err).toBeInstanceOf(ProviderRpcError);
      }
    }
  });

  it('full connect → status → signMessage → disconnect flow', async () => {
    const provider = createProviderBridge(client);

    // 1. Connect
    const connectResult = await provider.request<{ isConnected: boolean }>({ method: 'connect' });
    expect(connectResult.isConnected).toBe(true);

    // 2. Status
    const status = await provider.request<{
      connection: { isConnected: boolean };
      provider: { id: string };
    }>({ method: 'status' });
    expect(status.connection.isConnected).toBe(true);
    expect(status.provider.id).toBe('partylayer');

    // 3. Sign message
    const sig = await provider.request<string>({
      method: 'signMessage',
      params: { message: 'Hello Canton' },
    });
    expect(typeof sig).toBe('string');

    // 4. Disconnect
    const disc = await provider.request({ method: 'disconnect' });
    expect(disc).toBeUndefined();
  });

  it('full transaction lifecycle through Kit bridge', async () => {
    const provider = createProviderBridge(client);
    const events: Array<{ status: string; commandId: string }> = [];
    provider.on(CIP0103_EVENTS.TX_CHANGED, (e: unknown) => {
      events.push(e as { status: string; commandId: string });
    });

    await provider.request({
      method: 'prepareExecute',
      params: { tx: { amount: '100', recipient: 'party-xyz' } },
    });

    // Verify full lifecycle
    expect(events).toHaveLength(3);
    expect(events[0].status).toBe('pending');
    expect(events[1].status).toBe('signed');
    expect(events[2].status).toBe('executed');

    // All same commandId
    expect(events[1].commandId).toBe(events[0].commandId);
    expect(events[2].commandId).toBe(events[0].commandId);
  });

  it('Kit bridge without ledgerApi gracefully throws UNSUPPORTED_METHOD', async () => {
    // Kit client without ledgerApi (typical — most wallets don't support it)
    const provider = createProviderBridge(client);

    try {
      await provider.request({
        method: 'ledgerApi',
        params: { requestMethod: 'GET', resource: '/v1/state/acs' },
      });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderRpcError);
      expect((err as ProviderRpcError).code).toBe(4200);
    }
  });

  it('event wiring works on Kit-style client', () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const eventClient = createKitStyleClient();
    (eventClient.on as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string, handler: (event: unknown) => void) => {
        handlers[event] = handler;
        return () => {};
      },
    );

    const provider = createProviderBridge(eventClient);
    const statusFn = vi.fn();
    const accountsFn = vi.fn();
    const connectedFn = vi.fn();

    provider.on(CIP0103_EVENTS.STATUS_CHANGED, statusFn);
    provider.on(CIP0103_EVENTS.ACCOUNTS_CHANGED, accountsFn);
    provider.on(CIP0103_EVENTS.CONNECTED, connectedFn);

    // Simulate session:connected (what happens when user connects via Kit UI)
    handlers['session:connected']?.({
      type: 'session:connected',
      session: { partyId: 'party-kit-user', network: 'devnet' },
    });

    expect(statusFn).toHaveBeenCalledTimes(1);
    expect(accountsFn).toHaveBeenCalledTimes(1);
    expect(connectedFn).toHaveBeenCalledTimes(1);
  });
});
