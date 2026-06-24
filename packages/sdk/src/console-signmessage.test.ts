// @vitest-environment jsdom
/**
 * signMessage over the generic announce path (Faz 2 fix, base64 correction).
 *
 * LIVE-VERIFIED against the real Console extension (provider lpnf…):
 *   - Console's window.canton signMessage wants `{ message: <base64 string> }`
 *     (base64 of the message bytes) and NOTHING else — raw text, `{ hex }`, and
 *     any `metaData` all crash inside Console.
 *   - Console's response is an OBJECT `{ signature: '<base64>' }`.
 *
 * This suite pins:
 *   - Console (registry adapter.config.signMessageBase64:true) → base64-string param.
 *   - Send (no flag) → the RAW string `{ message }` (send-adapter.ts:241).
 *   - Response: a bare string OR `{ signature }` → a full SignedMessage.
 *
 * The bare-string param for Send is asserted so a future base64/hex-encode of
 * Send would FAIL this suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters → ConsoleAdapter module (SVG imports
// explode under Node). Stub the SDK; ConsoleAdapter logic is not under test here.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Control discoverProviders for the client-level test; keep the rest real.
const discoverMock = vi.fn();
vi.mock('@partylayer/provider', async (orig) => {
  const actual = await orig<typeof import('@partylayer/provider')>();
  return { ...actual, discoverProviders: (opts: unknown) => discoverMock(opts) };
});

import {
  toPartyId,
  toWalletId,
  type AdapterContext,
  type CIP0103Provider,
  type Session,
} from '@partylayer/core';
import { GenericAnnounceAdapter } from './announce-adapter';
import { createPartyLayer } from './client';

const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';
const SEND_ID = 'ldmohiccoioolenadmogclhoklmanpgi';

/** base64 of a message's UTF-8 bytes — same encoding the adapter uses. */
function b64(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
const HELLO_B64 = b64('Hello'); // 'SGVsbG8='

type SignArgs = { method: string; params?: unknown };

/** A recording provider whose signMessage returns a configurable response. */
function recorder(signResponse: unknown): CIP0103Provider & { calls: SignArgs[] } {
  const calls: SignArgs[] = [];
  const p = {
    calls,
    request: async (args: SignArgs) => {
      calls.push(args);
      if (args.method === 'signMessage') return signResponse;
      if (args.method === 'connect') return { isConnected: true };
      if (args.method === 'getPrimaryAccount')
        return { partyId: 'party::user', publicKey: 'pk', networkId: 'CANTON_NETWORK' };
      if (args.method === 'status') return { provider: { id: CONSOLE_ID } };
      return {};
    },
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as CIP0103Provider & { calls: SignArgs[] };
}

const ctx = { network: 'devnet' } as unknown as AdapterContext;
const session = (walletId: string): Session =>
  ({ walletId: toWalletId(walletId), partyId: toPartyId('party::user') } as unknown as Session);

function lastSign(p: { calls: SignArgs[] }): SignArgs | undefined {
  return [...p.calls].reverse().find((c) => c.method === 'signMessage');
}

// ── Console: base64-string param (no hex, no metaData); response normalization ─
describe('Console (signMessageBase64:true): base64-string param, normalized response', () => {
  it('sends { message: <base64> } with NO metaData and NO { hex }, and normalizes a { signature } object', async () => {
    const provider = recorder({ signature: '0xSIGB64' }); // Console returns an object
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider,
      config: { signMessageBase64: true },
    });

    const out = await adapter.signMessage(ctx, session('console'), {
      message: 'Hello',
      domain: 'example.com',
      nonce: 'n1',
    } as never);

    const sign = lastSign(provider)!;
    const params = sign.params as Record<string, unknown>;
    expect(sign.method).toBe('signMessage');
    // base64 STRING, equal to base64(input)
    expect(typeof params.message).toBe('string');
    expect(params.message).toBe(HELLO_B64);
    // NO metaData, NO hex object (the shapes that crashed Console)
    expect('metaData' in params).toBe(false);
    expect(typeof params.message === 'object').toBe(false);

    expect(String(out.signature)).toBe('0xSIGB64');
    expect(String(out.partyId)).toBe('party::user');
    expect(out.message).toBe('Hello'); // original message preserved on the SignedMessage
    expect(out.domain).toBe('example.com');
    expect(out.nonce).toBe('n1');
  });

  it('normalizes a BARE STRING response too (defensive)', async () => {
    const provider = recorder('rawsigstring');
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider,
      config: { signMessageBase64: true },
    });
    const out = await adapter.signMessage(ctx, session('console'), { message: 'Hello' } as never);
    expect(lastSign(provider)!.params).toEqual({ message: HELLO_B64 });
    expect(String(out.signature)).toBe('rawsigstring');
    expect(out.message).toBe('Hello');
    expect(String(out.partyId)).toBe('party::user');
  });
});

// ── Send: MUST stay the raw string (no regression) ───────────────────────────
describe('Send (no flag): raw-string param unchanged; response normalized', () => {
  it('sends params.message as the RAW STRING (no base64, no hex, no metaData)', async () => {
    const provider = recorder({ signature: '0xSENDSIG' });
    const adapter = new GenericAnnounceAdapter({
      announceId: SEND_ID,
      walletId: toWalletId('send'),
      provider,
      // NO signMessageBase64
    });

    const out = await adapter.signMessage(ctx, session('send'), { message: 'Hello' } as never);

    const params = lastSign(provider)!.params as Record<string, unknown>;
    // THE no-regression guard: Send's message is the raw string, NOT base64/hex.
    expect(typeof params.message).toBe('string');
    expect(params.message).toBe('Hello');
    expect(params.message).not.toBe(HELLO_B64); // explicitly NOT base64-encoded
    expect('metaData' in params).toBe(false);

    expect(String(out.signature)).toBe('0xSENDSIG');
    expect(String(out.partyId)).toBe('party::user');
    expect(out.message).toBe('Hello');
  });
});

// ── Client-level: registry config → bridge → connect → signMessage works ─────
describe('client.signMessage via the announce bridge (Console, no ConsoleAdapter)', () => {
  beforeEach(() => discoverMock.mockReset());

  it('returns a valid SignedMessage (NOT an error) end to end', async () => {
    const provider = recorder({ signature: '0xE2E' });
    discoverMock.mockResolvedValue([
      { id: CONSOLE_ID, provider, source: 'injected', name: 'Console Wallet', identityResolved: true },
    ]);

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'sigmsg', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [], // NO ConsoleAdapter — generic path only
      storage: { get: async () => null, set: async () => {}, remove: async () => {}, clear: async () => {} } as never,
      crypto: { encrypt: async (d: unknown) => d, decrypt: async (d: unknown) => d, generateKey: async () => 'k' } as never,
    });
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([
      {
        walletId: toWalletId('console'),
        name: 'Console Wallet',
        website: '',
        icons: {},
        capabilities: ['connect', 'signMessage', 'submitTransaction'],
        adapter: { packageName: '@partylayer/adapter-console', versionRange: '*' },
        docs: [],
        networks: ['devnet'],
        channel: 'stable',
        providerDetection: {
          transport: 'window.canton',
          matchers: [{ field: 'provider.id', match: 'exact', values: [CONSOLE_ID] }],
        },
      } as never,
    ]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockResolvedValue({
      id: 'console',
      adapter: { type: '@partylayer/adapter-console', transport: 'announce', config: { restore: true, signMessageBase64: true } },
    } as never);

    await client.listWallets({ includeExperimental: true }); // triggers bridge registration
    expect(client.getAdapter('console')).toBeInstanceOf(GenericAnnounceAdapter);

    await client.connect({ walletId: toWalletId('console') });
    const signed = await client.signMessage({ message: 'Hello' });

    // The bridge propagated signMessageBase64:true → base64 string reached the provider.
    expect((lastSign(provider)!.params as { message: string }).message).toBe(HELLO_B64);
    // And the result is a valid SignedMessage.
    expect(String(signed.signature)).toBe('0xE2E');
    expect(signed.message).toBe('Hello');
    expect(String(signed.partyId)).toBe('party::user');

    client.destroy();
  });
});
