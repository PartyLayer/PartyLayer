/**
 * Cantor8 adapter unit tests.
 *
 * IMPORTANT: these tests exercise the STUB / DEEP-LINK scaffold, NOT a
 * confirmed live Cantor8 (C8) interface. As documented in
 * docs/wallet-cip0103-matrix.md, the in-tree cantor8 integration:
 *   - detects "installed" purely from a mobile user-agent sniff,
 *   - builds deep-link / universal-link URLs via StubCantor8VendorModule,
 *   - and has NO confirmed live transport (extension / WalletConnect / deep
 *     link is unverified from public docs — see the matrix "live browser
 *     checks" section).
 *
 * To exercise connect/sign without a real wallet or a real DeepLinkTransport,
 * the adapter's private transport is replaced with a controllable fake that
 * returns canned ConnectResponse / SignResponse values. This lets us pin the
 * adapter's request/response handling and assert the deep-link URL the stub
 * vendor module produced.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TransportError,
  UserRejectedError,
  toPartyId,
  toSessionId,
  toWalletId,
  type AdapterContext,
  type CapabilityKey,
  type ConnectRequest,
  type Session,
} from '@partylayer/core';
import { Cantor8Adapter } from './cantor8-adapter';
import { StubCantor8VendorModule } from './vendor';

// ── Test harness ─────────────────────────────────────────────────────────────

function createMockContext(): AdapterContext {
  return {
    appName: 'Test App',
    origin: 'https://test.com',
    network: 'devnet',
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

function createMockSession(): Session {
  return {
    sessionId: toSessionId('test-session'),
    walletId: toWalletId('cantor8'),
    partyId: toPartyId('party::c8'),
    network: 'devnet',
    createdAt: Date.now(),
    origin: 'https://test.com',
    capabilitiesSnapshot: ['connect', 'signMessage'] as CapabilityKey[],
  };
}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120';

interface FakeTransport {
  openConnectRequest: ReturnType<typeof vi.fn>;
  openSignRequest: ReturnType<typeof vi.fn>;
}

/** Build an adapter whose private transport is a controllable fake. */
function adapterWithFakeTransport(
  responses: { connect?: unknown; sign?: unknown },
  vendorConfig: Record<string, unknown> = { deepLinkScheme: 'cantor8' },
  vendorModule?: unknown,
): { adapter: Cantor8Adapter; transport: FakeTransport } {
  const transport: FakeTransport = {
    openConnectRequest: vi.fn(async () => responses.connect ?? {}),
    openSignRequest: vi.fn(async () => responses.sign ?? {}),
  };
  const adapter = new Cantor8Adapter({
    useMockTransport: true, // avoid the real DeepLinkTransport
    vendorConfig,
    ...(vendorModule ? { vendorModule: vendorModule as never } : {}),
  });
  // Replace the private transport with our fake.
  (adapter as unknown as { transport: FakeTransport }).transport = transport;
  return { adapter, transport };
}

describe('Cantor8Adapter (stub / deep-link path — NOT a confirmed live C8 interface)', () => {
  let ctx: AdapterContext;

  beforeEach(() => {
    ctx = createMockContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── identity + capabilities ────────────────────────────────────────────────

  describe('identity & capabilities', () => {
    it('has the correct walletId and name', () => {
      const adapter = new Cantor8Adapter();
      expect(adapter.walletId).toBe(toWalletId('cantor8'));
      expect(adapter.name).toBe('Cantor8');
    });

    it('declares the deep-link capability set', () => {
      const caps = new Cantor8Adapter().getCapabilities();
      expect(caps).toEqual(
        expect.arrayContaining([
          'connect',
          'disconnect',
          'restore',
          'deeplink',
          'signMessage',
          'signTransaction',
        ]),
      );
    });
  });

  // ── detectInstalled (user-agent sniff ONLY) ────────────────────────────────

  describe('detectInstalled (mobile user-agent sniff only — not a real probe)', () => {
    it('returns false when there is no window (non-browser)', async () => {
      const result = await new Cantor8Adapter().detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toMatch(/browser/i);
    });

    it('returns true for a mobile user-agent', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('navigator', { userAgent: MOBILE_UA });
      const result = await new Cantor8Adapter().detectInstalled();
      expect(result.installed).toBe(true);
    });

    it('returns false for a desktop user-agent (with reason)', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('navigator', { userAgent: DESKTOP_UA });
      const result = await new Cantor8Adapter().detectInstalled();
      expect(result.installed).toBe(false);
      expect(result.reason).toMatch(/mobile wallet/i);
    });
  });

  // ── Stub vendor module: deep-link URL construction ─────────────────────────

  describe('StubCantor8VendorModule — deep-link URL construction', () => {
    const vendor = new StubCantor8VendorModule();
    const connectRequest: ConnectRequest = {
      appName: 'Test App',
      origin: 'https://test.com',
      network: 'devnet',
      requestedCapabilities: undefined,
      state: 'abc123',
      redirectUri: 'https://test.com/callback',
    };

    it('builds a cantor8:// deep-link connect URL from deepLinkScheme', () => {
      const url = vendor.createConnectUrl(connectRequest, { deepLinkScheme: 'cantor8' });
      expect(url.startsWith('cantor8://connect?')).toBe(true);
      expect(url).toContain('state=abc123');
      expect(url).toContain('network=devnet');
    });

    it('prefers a universal link when universalLinkBase is set', () => {
      const url = vendor.createConnectUrl(connectRequest, {
        universalLinkBase: 'https://app.cantor8.tech',
        connectEndpoint: '/connect',
      });
      expect(url.startsWith('https://app.cantor8.tech/connect')).toBe(true);
      expect(url).toContain('state=abc123');
    });

    it('throws "not configured" when neither scheme nor universal link is set', () => {
      expect(() => vendor.createConnectUrl(connectRequest, {})).toThrow(/not configured/i);
    });

    it('builds a cantor8://sign URL for a sign request', () => {
      const url = vendor.createSignUrl(
        { message: 'hello', state: 'sign-state', redirectUri: 'https://test.com/cb' },
        { deepLinkScheme: 'cantor8' },
      );
      expect(url.startsWith('cantor8://sign?')).toBe(true);
      expect(url).toContain('state=sign-state');
    });

    it('createSignUrl throws when vendor is not configured', () => {
      expect(() =>
        vendor.createSignUrl({ message: 'x', state: 's', redirectUri: 'r' }, {}),
      ).toThrow(/not configured/i);
    });

    it('parseConnectCallback rejects a state mismatch', () => {
      expect(() =>
        vendor.parseConnectCallback({ state: 'wrong' }, 'expected'),
      ).toThrow(/state mismatch/i);
    });
  });

  // ── connect (through the fake deep-link transport) ─────────────────────────

  describe('connect (deep-link transport, faked)', () => {
    it('returns partyId + session and constructs a cantor8:// connect URL', async () => {
      const { adapter, transport } = adapterWithFakeTransport({
        connect: {
          state: 'abc',
          partyId: toPartyId('party::c8-connected'),
          sessionToken: 'tok-1',
          expiresAt: Date.now() + 60_000,
          capabilities: ['connect', 'signMessage'],
        },
      });

      const result = await adapter.connect(ctx);

      // The stub vendor built a deep-link URL and handed it to the transport.
      const urlArg = transport.openConnectRequest.mock.calls[0][0] as string;
      expect(urlArg.startsWith('cantor8://connect?')).toBe(true);

      expect(result.partyId).toBe(toPartyId('party::c8-connected'));
      expect(result.session.walletId).toBe(toWalletId('cantor8'));
      expect(result.session.metadata?.sessionToken).toBe('tok-1');
      expect(result.capabilities).toEqual(['connect', 'signMessage']);
    });

    it('maps a USER_REJECTED transport error to UserRejectedError', async () => {
      const { adapter } = adapterWithFakeTransport({
        connect: { error: { code: 'USER_REJECTED', message: 'nope' } },
      });
      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('throws when the response carries no partyId', async () => {
      const { adapter } = adapterWithFakeTransport({
        connect: { state: 'abc' }, // no partyId, no error
      });
      await expect(adapter.connect(ctx)).rejects.toBeInstanceOf(TransportError);
    });
  });

  // ── signMessage (through the fake deep-link transport) ──────────────────────

  describe('signMessage (deep-link transport, faked)', () => {
    it('returns the signature and builds a cantor8://sign URL', async () => {
      const { adapter, transport } = adapterWithFakeTransport({
        sign: { state: 's', signature: 'c8-sig' },
      });
      const result = await adapter.signMessage(ctx, createMockSession(), { message: 'hi' });
      const urlArg = transport.openSignRequest.mock.calls[0][0] as string;
      expect(urlArg.startsWith('cantor8://sign?')).toBe(true);
      expect(String(result.signature)).toBe('c8-sig');
      expect(result.message).toBe('hi');
    });

    it('maps USER_REJECTED to UserRejectedError', async () => {
      const { adapter } = adapterWithFakeTransport({
        sign: { state: 's', error: { code: 'USER_REJECTED', message: 'declined' } },
      });
      await expect(
        adapter.signMessage(ctx, createMockSession(), { message: 'hi' }),
      ).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('throws when no signature is returned', async () => {
      const { adapter } = adapterWithFakeTransport({ sign: { state: 's' } });
      await expect(
        adapter.signMessage(ctx, createMockSession(), { message: 'hi' }),
      ).rejects.toBeInstanceOf(TransportError);
    });
  });

  // ── signTransaction (through the fake deep-link transport) ──────────────────

  describe('signTransaction (deep-link transport, faked)', () => {
    it('returns a signed tx from a direct signature response', async () => {
      const { adapter } = adapterWithFakeTransport({
        sign: { state: 's', signature: 'tx-sig', transactionHash: '0xhash' },
      });
      const result = await adapter.signTransaction(ctx, createMockSession(), {
        tx: { foo: 'bar' },
      });
      expect(String(result.transactionHash)).toBe('0xhash');
      expect(result.partyId).toBe(toPartyId('party::c8'));
      // signature is merged into the signedTx object
      expect((result.signedTx as Record<string, unknown>).signature).toBe('tx-sig');
    });

    it('resolves an async approval via vendor.pollJobStatus (approved)', async () => {
      const vendor = new StubCantor8VendorModule();
      (vendor as unknown as { pollJobStatus: unknown }).pollJobStatus = vi.fn(async () => ({
        status: 'approved',
        result: { signature: 'polled-sig', transactionHash: '0xpolled' },
      }));
      const { adapter } = adapterWithFakeTransport(
        { sign: { state: 's', jobId: 'job-1' } },
        { deepLinkScheme: 'cantor8', statusEndpoint: 'https://status' },
        vendor,
      );
      const result = await adapter.signTransaction(ctx, createMockSession(), { tx: {} });
      expect(String(result.transactionHash)).toBe('0xpolled');
      expect((result.signedTx as Record<string, unknown>).signature).toBe('polled-sig');
    });

    it('maps a denied async approval to UserRejectedError', async () => {
      const vendor = new StubCantor8VendorModule();
      (vendor as unknown as { pollJobStatus: unknown }).pollJobStatus = vi.fn(async () => ({
        status: 'denied',
      }));
      const { adapter } = adapterWithFakeTransport(
        { sign: { state: 's', jobId: 'job-2' } },
        { deepLinkScheme: 'cantor8', statusEndpoint: 'https://status' },
        vendor,
      );
      await expect(
        adapter.signTransaction(ctx, createMockSession(), { tx: {} }),
      ).rejects.toBeInstanceOf(UserRejectedError);
    });

    it('throws when no signature and no jobId is returned', async () => {
      const { adapter } = adapterWithFakeTransport({ sign: { state: 's' } });
      await expect(
        adapter.signTransaction(ctx, createMockSession(), { tx: {} }),
      ).rejects.toBeInstanceOf(TransportError);
    });
  });
});
