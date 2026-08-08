/**
 * Test suite for the Wintip Wallet adapter.
 *
 * Mocks `window.canton`/`window.wintipCantonProvider` directly (Wintip's own
 * provider script sets both — the adapter checks wintipCantonProvider first,
 * falling back to canton) rather than any transport-level machinery, since
 * this adapter has none of its own: the injected provider IS already the
 * live connection, everything just calls .request() on it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CapabilityNotSupportedError,
  TransportError,
  UserRejectedError,
  WalletNotInstalledError,
  toPartyId,
  toSessionId,
  toWalletId,
  type AdapterContext,
  type Session,
} from '@partylayer/core';

import { WintipAdapter } from './wintip-adapter';

const REAL_ACCOUNT = {
  partyId: 'wintip-alice::12200b9c9fb45ade713dce1ef55ecf311d57bfff6fb04d874cc7f65a7e3ec19e9824',
  status: 'allocated' as const,
  hint: 'alice',
  publicKey: '',
  namespace: '12200b9c9fb45ade713dce1ef55ecf311d57bfff6fb04d874cc7f65a7e3ec19e9824',
  networkId: 'canton:da-mainnet',
  signingProviderId: 'org.wintip.wallet',
  primary: true,
  disabled: false,
};

const REAL_STATUS = {
  provider: { id: 'wintip-wallet', version: '1.0', providerType: 'browser' as const },
  connection: { isConnected: true, isNetworkConnected: true },
  network: { networkId: 'canton:da-mainnet' },
};

function rpcError(code: number, message: string): Error & { code: number } {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  return err;
}

/** Installs a fake window.wintipCantonProvider with a scriptable request() mock. */
function installMockWintip(handlers: Record<string, (params?: unknown) => unknown>) {
  const request = vi.fn(async (args: { method: string; params?: unknown }) => {
    const handler = handlers[args.method];
    if (!handler) throw rpcError(-32601, `Unknown method: ${args.method}`);
    const result = handler(args.params);
    if (result instanceof Error) throw result;
    return result;
  });
  const provider = {
    request,
    on: vi.fn(),
    emit: vi.fn(() => false),
    removeListener: vi.fn(),
  };
  (globalThis as Record<string, unknown>).window = {
    wintipCantonProvider: provider,
  };
  return { provider, request };
}

function uninstallMockWintip() {
  delete (globalThis as Record<string, unknown>).window;
}

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.example.com',
    network: 'mainnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
      }),
  };
}

function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: toSessionId('sess-test'),
    walletId: toWalletId('wintip'),
    partyId: toPartyId(REAL_ACCOUNT.partyId),
    network: 'mainnet',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('WintipAdapter', () => {
  let adapter: WintipAdapter;
  let ctx: AdapterContext;

  beforeEach(() => {
    adapter = new WintipAdapter();
    ctx = createMockContext();
  });

  afterEach(() => {
    uninstallMockWintip();
    vi.restoreAllMocks();
  });

  describe('basic shape', () => {
    it('has a stable walletId and display name', () => {
      expect(adapter.walletId).toBe('wintip');
      expect(adapter.name).toBe('Wintip Wallet');
    });

    it('does NOT declare signMessage or signTransaction — Wintip is custodial', () => {
      const caps = adapter.getCapabilities();
      expect(caps).not.toContain('signMessage');
      expect(caps).not.toContain('signTransaction');
      expect(adapter.signMessage).toBeUndefined();
      expect(adapter.signTransaction).toBeUndefined();
    });

    it('declares exactly the capabilities it implements (no drift)', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toEqual(['connect', 'disconnect', 'restore', 'submitTransaction', 'ledgerApi', 'events', 'injected']);
    });
  });

  describe('detectInstalled', () => {
    it('reports not installed when no provider is present', async () => {
      uninstallMockWintip();
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(false);
    });

    it('reports installed when wintipCantonProvider is present', async () => {
      installMockWintip({});
      const result = await adapter.detectInstalled();
      expect(result.installed).toBe(true);
    });
  });

  describe('connect', () => {
    it('returns the connected partyId and wallet-reported network', async () => {
      installMockWintip({
        connect: () => ({ isConnected: true }),
        getPrimaryAccount: () => REAL_ACCOUNT,
        status: () => REAL_STATUS,
      });

      const result = await adapter.connect(ctx);

      expect(result.partyId).toBe(REAL_ACCOUNT.partyId);
      expect(result.session.network).toBe('canton:da-mainnet');
      expect(result.session.walletId).toBe('wintip');
      expect(result.capabilities).toEqual(adapter.getCapabilities());
    });

    it('falls back to ctx.network when status() reports nothing recognized', async () => {
      installMockWintip({
        connect: () => ({ isConnected: true }),
        getPrimaryAccount: () => ({ ...REAL_ACCOUNT, networkId: '' }),
        status: () => ({ ...REAL_STATUS, network: { networkId: 'canton:unknown-devnet' } }),
      });

      const result = await adapter.connect(ctx);
      expect(result.session.network).toBe('mainnet'); // ctx.network — unrecognized report must not override
    });

    it('throws WalletNotInstalledError when no provider is present', async () => {
      uninstallMockWintip();
      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(WalletNotInstalledError);
    });

    it('maps a rejected connect() into UserRejectedError', async () => {
      installMockWintip({
        connect: () => ({ isConnected: false, reason: 'User rejected the connection request' }),
      });

      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('maps an RPC 4001 error code into UserRejectedError even without matching wording', async () => {
      installMockWintip({
        connect: () => rpcError(4001, 'nope'),
      });

      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('maps an RPC 4200 (UNSUPPORTED_METHOD) error into CapabilityNotSupportedError', async () => {
      installMockWintip({
        connect: () => rpcError(4200, 'nope'),
      });

      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    });

    it('falls back to TransportError for an unrecognized RPC code', async () => {
      installMockWintip({
        connect: () => rpcError(4100, 'Not signed in to Wintip Wallet'),
      });

      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(TransportError);
    });
  });

  describe('restore', () => {
    it('returns null when the wallet reports not connected', async () => {
      installMockWintip({
        isConnected: () => ({ isConnected: false }),
      });
      const persisted = { ...createMockSession(), expiresAt: undefined };
      expect(await adapter.restore(ctx, persisted)).toBeNull();
    });

    it('returns null when the active account no longer matches the persisted party', async () => {
      installMockWintip({
        isConnected: () => ({ isConnected: true }),
        getPrimaryAccount: () => ({ ...REAL_ACCOUNT, partyId: 'someone-else::1220aa' }),
      });
      const persisted = { ...createMockSession(), expiresAt: undefined };
      expect(await adapter.restore(ctx, persisted)).toBeNull();
    });

    it('returns an updated session when the account still matches', async () => {
      installMockWintip({
        isConnected: () => ({ isConnected: true }),
        getPrimaryAccount: () => REAL_ACCOUNT,
      });
      const persisted = { ...createMockSession(), expiresAt: undefined };
      const result = await adapter.restore(ctx, persisted);
      expect(result?.partyId).toBe(REAL_ACCOUNT.partyId);
    });

    it('returns null (not a throw) when no provider is present', async () => {
      uninstallMockWintip();
      const persisted = { ...createMockSession(), expiresAt: undefined };
      expect(await adapter.restore(ctx, persisted)).toBeNull();
    });
  });

  describe('submitTransaction', () => {
    it('returns a TxReceipt from a flat prepareExecuteAndWait response (Wintip\'s real shape)', async () => {
      installMockWintip({
        prepareExecuteAndWait: () => ({
          tx: { status: 'executed', commandId: 'cmd-1', updateId: 'upd-1', completionOffset: 42 },
        }),
      });

      const receipt = await adapter.submitTransaction(ctx, createMockSession(), {
        signedTx: { commands: [{ ExerciseCommand: {} }], commandId: 'cmd-1' },
      });

      expect(receipt.updateId).toBe('upd-1');
      expect(receipt.commandId).toBe('cmd-1');
      expect(receipt.transactionHash).toBe('upd-1');
    });

    it('also accepts the canonical CIP0103TxExecutedPayload nested shape', async () => {
      installMockWintip({
        prepareExecuteAndWait: () => ({
          tx: { status: 'executed', commandId: 'cmd-2', payload: { updateId: 'upd-2', completionOffset: 7 } },
        }),
      });

      const receipt = await adapter.submitTransaction(ctx, createMockSession(), {
        signedTx: { commands: [{ ExerciseCommand: {} }], commandId: 'cmd-2' },
      });

      expect(receipt.updateId).toBe('upd-2');
    });

    it('rejects when signedTx has no commands array', async () => {
      installMockWintip({});
      await expect(
        adapter.submitTransaction(ctx, createMockSession(), { signedTx: { commands: [] } }),
      ).rejects.toThrow();
    });

    it('rejects when the wallet returns a non-executed status', async () => {
      installMockWintip({
        prepareExecuteAndWait: () => ({ tx: { status: 'failed', commandId: 'cmd-3' } }),
      });
      await expect(
        adapter.submitTransaction(ctx, createMockSession(), {
          signedTx: { commands: [{ ExerciseCommand: {} }] },
        }),
      ).rejects.toThrow();
    });
  });

  describe('ledgerApi', () => {
    it('JSON-stringifies the returned data as the response', async () => {
      installMockWintip({
        ledgerApi: () => ({ status: 200, data: { offset: 42 } }),
      });

      const result = await adapter.ledgerApi(ctx, createMockSession(), {
        requestMethod: 'GET',
        resource: '/v2/state/ledger-end',
      });

      expect(JSON.parse(result.response)).toEqual({ offset: 42 });
    });
  });

  describe('events', () => {
    it('subscribes only to txStatus, no-ops for anything else', () => {
      const { provider } = installMockWintip({});
      const handler = vi.fn();

      const unsubOther = adapter.on!('connect', handler);
      expect(provider.on).not.toHaveBeenCalled();
      unsubOther();

      const unsubTx = adapter.on!('txStatus', handler);
      expect(provider.on).toHaveBeenCalledWith('txChanged', expect.any(Function));
      unsubTx();
      expect(provider.removeListener).toHaveBeenCalled();
    });
  });
});
