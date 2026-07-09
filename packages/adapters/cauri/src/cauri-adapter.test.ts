import { describe, it, expect, vi } from 'vitest';
import type { AdapterContext, PersistedSession, Session } from '@partylayer/core';
import { toPartyId } from '@partylayer/core';
import { CauriRemoteAdapter } from './cauri-adapter';

const cfg = {
  apiBase: 'http://localhost:8090',
  walletUiBase: 'http://localhost:5173',
};

function stubCtx(): AdapterContext {
  const noop = (..._args: unknown[]) => undefined;
  return {
    origin: 'https://dapp.example.com',
    network: 'global',
    logger: { debug: noop, info: noop, warn: noop, error: noop },
    telemetry: { track: noop, error: noop },
  } as unknown as AdapterContext;
}

describe('CauriRemoteAdapter', () => {
  it('exposes walletId "cauri"', () => {
    expect(String(new CauriRemoteAdapter(cfg).walletId)).toBe('cauri');
  });

  it('defaults display name to "Cauri Wallet"', () => {
    expect(new CauriRemoteAdapter(cfg).name).toBe('Cauri Wallet');
  });

  it('honours a custom display name', () => {
    expect(new CauriRemoteAdapter({ ...cfg, name: 'Cauri (devnet)' }).name).toBe('Cauri (devnet)');
  });

  it('strips trailing slashes from both base URLs', () => {
    const adapter = new CauriRemoteAdapter({
      apiBase: 'http://localhost:8090///',
      walletUiBase: 'http://localhost:5173//',
    });
    expect((adapter as unknown as { rpc: { apiBase: string } }).rpc.apiBase).toBe('http://localhost:8090');
    expect((adapter as unknown as { walletUiBase: string }).walletUiBase).toBe('http://localhost:5173');
  });

  it('reports the expected capability set', () => {
    expect(new CauriRemoteAdapter(cfg).getCapabilities()).toEqual([
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
      'events',
      'popup',
      'remoteSigner',
    ]);
  });

  it('always reports installed (remote wallet — no dApp-side detection)', async () => {
    const result = await new CauriRemoteAdapter(cfg).detectInstalled();
    expect(result.installed).toBe(true);
  });
});

// ============================================================================
// restore()
// ============================================================================

describe('CauriRemoteAdapter.restore', () => {
  function persistedFor(metadata: Record<string, unknown> | undefined): PersistedSession {
    return {
      partyId: toPartyId('cauri-nidd::1220ab'),
      network: 'global',
      origin: 'https://dapp.example.com',
      createdAt: Date.now(),
      metadata,
      encrypted: 'ignored',
    } as PersistedSession;
  }

  it('returns null when the persisted session has no Cauri metadata', async () => {
    const adapter = new CauriRemoteAdapter(cfg);
    const rpcCall = vi.fn();
    (adapter as unknown as { rpc: { call: typeof rpcCall } }).rpc.call = rpcCall;

    const result = await adapter.restore(stubCtx(), persistedFor(undefined));

    expect(result).toBeNull();
    expect(rpcCall).not.toHaveBeenCalled();
  });

  it('returns null when the gateway says the session is not connected', async () => {
    const adapter = new CauriRemoteAdapter(cfg);
    const rpcCall = vi
      .fn()
      .mockResolvedValueOnce({ isConnected: false, isNetworkConnected: true });
    (adapter as unknown as { rpc: { call: typeof rpcCall } }).rpc.call = rpcCall;

    const result = await adapter.restore(
      stubCtx(),
      persistedFor({ cauriSessionId: 'sid', cauriSessionToken: 'stok' }),
    );

    expect(result).toBeNull();
    expect(rpcCall).toHaveBeenCalledWith('isConnected', undefined, 'stok');
  });

  it('returns the persisted session and fires connect when isConnected=true', async () => {
    const adapter = new CauriRemoteAdapter(cfg);
    const rpcCall = vi
      .fn()
      .mockResolvedValueOnce({ isConnected: true, isNetworkConnected: true });
    (adapter as unknown as { rpc: { call: typeof rpcCall } }).rpc.call = rpcCall;
    // Prevent EventSource construction under a node vitest env.
    (adapter as unknown as { getOrOpenStream: () => void }).getOrOpenStream = () => undefined;

    const events: unknown[] = [];
    adapter.on('connect', (p) => events.push(p));

    const persisted = persistedFor({ cauriSessionId: 'sid', cauriSessionToken: 'stok' });
    const result = await adapter.restore(stubCtx(), persisted);

    expect(result).toBe(persisted);
    expect(events).toEqual([{ partyId: persisted.partyId, sessionId: 'sid' }]);
  });

  it('returns null (fail closed) when the isConnected probe throws', async () => {
    const adapter = new CauriRemoteAdapter(cfg);
    const rpcCall = vi.fn().mockRejectedValueOnce(new Error('network down'));
    (adapter as unknown as { rpc: { call: typeof rpcCall } }).rpc.call = rpcCall;

    const result = await adapter.restore(
      stubCtx(),
      persistedFor({ cauriSessionId: 'sid', cauriSessionToken: 'stok' }),
    );

    expect(result).toBeNull();
  });
});

// ============================================================================
// signMessage()
// ============================================================================

describe('CauriRemoteAdapter.signMessage', () => {
  function sessionWithout(metadata: Record<string, unknown> | undefined): Session {
    return {
      partyId: toPartyId('cauri-nidd::1220ab'),
      network: 'global',
      origin: 'https://dapp.example.com',
      createdAt: Date.now(),
      metadata,
    } as Session;
  }

  it('throws before opening a popup when the session is missing the Cauri token', async () => {
    const adapter = new CauriRemoteAdapter(cfg);
    // If the guard regressed to run after the popup, we'd see this fire.
    (adapter as unknown as { rpc: { call: () => Promise<unknown> } }).rpc.call = () => {
      throw new Error('signMessage RPC must not be called without a session token');
    };

    await expect(
      adapter.signMessage(stubCtx(), sessionWithout({}), { message: 'hi' }),
    ).rejects.toThrow(/session is missing sessionToken metadata/);
  });
});
