/**
 * Walley adapter tests.
 *
 * The runtime environment is Node (no DOM), so the popup + postMessage flow is
 * driven through a hand-rolled `window` mock that lets each test feed the
 * `ready` signal and the JSON-RPC response back to the transport.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterContext, Session, CapabilityKey, SessionId } from '@partylayer/core';
import {
  CapabilityNotSupportedError,
  UserRejectedError,
  toPartyId,
  toSessionId,
  toWalletId,
} from '@partylayer/core';

import { WalleyAdapter } from './walley-adapter';
import { resolveWalleyHost } from './constants';

const HOST = 'https://walley.cc';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

type MessageListener = (event: { origin: string; data: unknown }) => void;

function installWindow(host: string) {
  const listeners: MessageListener[] = [];
  const popup = {
    closed: false,
    postMessage: vi.fn(),
    close: vi.fn(() => {
      popup.closed = true;
    }),
  };
  const win = {
    screenX: 0,
    screenY: 0,
    outerWidth: 1024,
    outerHeight: 768,
    open: vi.fn(() => popup),
    addEventListener: (type: string, fn: MessageListener) => {
      if (type === 'message') listeners.push(fn);
    },
    removeEventListener: (type: string, fn: MessageListener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  (globalThis as { window?: unknown }).window = win;

  return {
    popup,
    emit(data: unknown, origin = host) {
      for (const fn of [...listeners]) fn({ origin, data });
    },
    lastRequest(): JsonRpcRequest {
      const calls = popup.postMessage.mock.calls;
      return calls[calls.length - 1][0] as JsonRpcRequest;
    },
  };
}

function uninstallWindow() {
  delete (globalThis as { window?: unknown }).window;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://dapp.test',
    network: 'mainnet',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    registry: { getWallet: vi.fn() },
    crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    timeout: (ms: number) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  } as unknown as AdapterContext;
}

function createMockSession(overrides?: Partial<Session>): Session {
  return {
    sessionId: toSessionId('test-session') as SessionId,
    walletId: toWalletId('walley'),
    partyId: toPartyId('walley-alice::1220abcd'),
    network: 'mainnet',
    createdAt: Date.now(),
    origin: 'https://dapp.test',
    capabilitiesSnapshot: ['connect', 'signMessage'] as CapabilityKey[],
    metadata: { host: HOST, accessToken: 'tok_123', apiBaseUrl: HOST },
    ...overrides,
  };
}

describe('WalleyAdapter', () => {
  let adapter: WalleyAdapter;

  beforeEach(() => {
    adapter = new WalleyAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallWindow();
  });

  describe('identity & capabilities', () => {
    it('exposes the walley wallet id and name', () => {
      expect(String(adapter.walletId)).toBe('walley');
      expect(adapter.name).toBe('Walley');
    });

    it('advertises the popup capability set', () => {
      const caps = adapter.getCapabilities();
      expect(caps).toEqual(
        expect.arrayContaining([
          'connect',
          'disconnect',
          'restore',
          'signMessage',
          'submitTransaction',
          'ledgerApi',
          'popup',
        ]),
      );
      expect(caps).not.toContain('signTransaction');
    });
  });

  describe('resolveWalleyHost', () => {
    it('resolves the hosted wallet (mainnet only for public access)', () => {
      expect(resolveWalleyHost('mainnet')).toBe('https://walley.cc');
      // Non-public networks have no hosted deployment — fall back to the prod host.
      expect(resolveWalleyHost('devnet')).toBe('https://walley.cc');
      expect(resolveWalleyHost('testnet')).toBe('https://walley.cc');
    });

    it('honours an explicit override (self-hosted) and trims trailing slashes', () => {
      expect(resolveWalleyHost('mainnet', 'http://localhost:5173/')).toBe('http://localhost:5173');
    });
  });

  describe('detectInstalled', () => {
    it('reports not installed without a browser window', async () => {
      const res = await adapter.detectInstalled();
      expect(res.installed).toBe(false);
    });

    it('reports installed when window.open exists', async () => {
      installWindow(HOST);
      const res = await adapter.detectInstalled();
      expect(res.installed).toBe(true);
    });
  });

  describe('connect', () => {
    it('opens the connect popup and maps the result into a session', async () => {
      const ctrl = installWindow(HOST);
      const ctx = createMockContext();

      const promise = adapter.connect(ctx);
      await flush();
      ctrl.emit({ ready: true });
      await flush();

      const req = ctrl.lastRequest();
      expect(req.method).toBe('connect');
      expect(ctx.logger).toBeDefined();
      expect((ctrl.popup.postMessage.mock.calls[0][1] as string)).toBe(HOST);

      ctrl.emit({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          partyId: 'walley-alice::1220abcd',
          partyHint: 'walley-alice',
          publicKeyFingerprint: '1220abcd',
          publicKeyBase64: 'AAAA',
          networkId: 'canton:mainnet',
          accessToken: 'tok_123',
          expiresAt: 4102444800,
          apiBaseUrl: 'https://api.walley.cc',
        },
      });

      const result = await promise;
      expect(String(result.partyId)).toBe('walley-alice::1220abcd');
      expect(result.session.metadata?.accessToken).toBe('tok_123');
      expect(result.session.metadata?.apiBaseUrl).toBe('https://api.walley.cc');
      expect(result.session.metadata?.signingMethod).toBe('webauthn-prf');
      expect(result.session.network).toBe('mainnet');
      expect(result.capabilities).toContain('signMessage');
    });

    it('rejects with UserRejectedError when the popup is closed', async () => {
      const ctrl = installWindow(HOST);
      const ctx = createMockContext();

      const promise = adapter.connect(ctx);
      await flush();
      ctrl.popup.closed = true;

      await expect(promise).rejects.toBeInstanceOf(UserRejectedError);
    });
  });

  describe('signMessage', () => {
    it('returns the signature from the sign popup', async () => {
      const ctrl = installWindow(HOST);
      const ctx = createMockContext();
      const session = createMockSession();

      const promise = adapter.signMessage(ctx, session, { message: 'hello' });
      await flush();
      ctrl.emit({ ready: true });
      await flush();

      const req = ctrl.lastRequest();
      expect(req.method).toBe('signMessage');
      expect(req.params).toEqual({ message: 'hello' });

      ctrl.emit({ jsonrpc: '2.0', id: req.id, result: { signature: 'sig_b64' } });

      const signed = await promise;
      expect(String(signed.signature)).toBe('sig_b64');
      expect(signed.message).toBe('hello');
      expect(signed.partyId).toBe(session.partyId);
    });
  });

  describe('user rejection', () => {
    it('treats an explicit Cancel (error as the popup closes) as UserRejectedError', async () => {
      const ctrl = installWindow(HOST);
      const promise = adapter.signMessage(createMockContext(), createMockSession(), { message: 'hi' });
      await flush();
      ctrl.emit({ ready: true });
      await flush();
      const req = ctrl.lastRequest();
      // Walley's Cancel closes the window, then json-rpc mangles its message to code 0.
      ctrl.popup.closed = true;
      ctrl.emit({ jsonrpc: '2.0', id: req.id, error: { code: 0, message: 'An unexpected error occurred' } });
      await expect(promise).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('treats EIP-1193 code 4001 as UserRejectedError', async () => {
      const ctrl = installWindow(HOST);
      const promise = adapter.signMessage(createMockContext(), createMockSession(), { message: 'hi' });
      await flush();
      ctrl.emit({ ready: true });
      await flush();
      const req = ctrl.lastRequest();
      ctrl.emit({ jsonrpc: '2.0', id: req.id, error: { code: 4001, message: 'User rejected the request' } });
      await expect(promise).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('keeps a genuine error (popup open, non-4001) distinct from a rejection', async () => {
      const ctrl = installWindow(HOST);
      const promise = adapter.signMessage(createMockContext(), createMockSession(), { message: 'hi' });
      await flush();
      ctrl.emit({ ready: true });
      await flush();
      const req = ctrl.lastRequest();
      ctrl.emit({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: 'boom' } });
      const err = await promise.catch((e) => e);
      expect(err).not.toBeInstanceOf(UserRejectedError);
    });
  });

  describe('signTransaction', () => {
    it('is not supported (Walley fuses sign + submit)', async () => {
      const ctx = createMockContext();
      const session = createMockSession();
      await expect(
        adapter.signTransaction(ctx, session, { tx: {} }),
      ).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    });
  });

  describe('submitTransaction', () => {
    it('falls back to the caller commandId when Walley resolves null', async () => {
      const ctrl = installWindow(HOST);
      const ctx = createMockContext();
      const session = createMockSession();

      const promise = adapter.submitTransaction(ctx, session, {
        signedTx: { commands: [], commandId: 'cmd-1' },
      });
      await flush();
      ctrl.emit({ ready: true });
      await flush();

      const req = ctrl.lastRequest();
      expect(req.method).toBe('prepareExecuteAndWait');

      ctrl.emit({ jsonrpc: '2.0', id: req.id, result: null });

      const receipt = await promise;
      expect(String(receipt.transactionHash)).toBe('cmd-1');
      expect(receipt.commandId).toBe('cmd-1');
    });

    it('prefers updateId from a populated result', async () => {
      const ctrl = installWindow(HOST);
      const ctx = createMockContext();
      const session = createMockSession();

      const promise = adapter.submitTransaction(ctx, session, {
        signedTx: { commands: [], commandId: 'cmd-2' },
      });
      await flush();
      ctrl.emit({ ready: true });
      await flush();

      const req = ctrl.lastRequest();
      ctrl.emit({
        jsonrpc: '2.0',
        id: req.id,
        result: { updateId: 'upd-9', commandId: 'cmd-2' },
      });

      const receipt = await promise;
      expect(String(receipt.transactionHash)).toBe('upd-9');
      expect(receipt.updateId).toBe('upd-9');
    });
  });

  describe('ledgerApi', () => {
    it('throws when the session has no access token', async () => {
      const ctx = createMockContext();
      const session = createMockSession({ metadata: { host: HOST } });
      await expect(
        adapter.ledgerApi(ctx, session, { requestMethod: 'GET', resource: '/v2/state/acs' }),
      ).rejects.toBeTruthy();
    });

    it('proxies through /v1/proxy with a bearer token', async () => {
      const ctx = createMockContext();
      const session = createMockSession();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '{"contracts":[]}',
      }));
      (globalThis as { fetch?: unknown }).fetch = fetchMock;

      const res = await adapter.ledgerApi(ctx, session, {
        requestMethod: 'GET',
        resource: 'v2/state/acs',
      });

      expect(res.response).toBe('{"contracts":[]}');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${HOST}/v1/proxy/v2/state/acs`);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_123');

      delete (globalThis as { fetch?: unknown }).fetch;
    });
  });
});
