// @vitest-environment jsdom
/**
 * signMessage over the generic announce path (Faz 2 fix).
 *
 * Pins the config-driven param-shape + universal response normalization in
 * GenericAnnounceAdapter.signMessage (announce-adapter.ts):
 *   - Console (registry adapter.config.signMessageHex:true) → hex-object param
 *     `{ message: { hex }, metaData: { purpose:'sign-message', ... } }`
 *     (mirrors ConsoleAdapter, console-adapter.ts:442-456).
 *   - Send (no flag) → the RAW string `{ message }` (send-adapter.ts:241).
 *   - Response: a bare string OR `{ signature }` → a full SignedMessage
 *     synthesized from session+params.
 *
 * The bare-string param for Send is asserted so a future hex-encode of Send
 * would FAIL this suite.
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

// hex of "Hello" (UTF-8) — matches ConsoleAdapter's encoder.
const HELLO_HEX = '0x48656c6c6f';

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

// ── Console: hex-object param + metaData; response normalization ─────────────
describe('Console (signMessageHex:true): hex param + metaData, normalized response', () => {
  it('sends { message: { hex }, metaData.purpose } and normalizes a BARE STRING response', async () => {
    const provider = recorder('0xSIGNATURE'); // bare string response
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider,
      config: { signMessageHex: true },
    });

    const out = await adapter.signMessage(ctx, session('console'), {
      message: 'Hello',
      domain: 'example.com',
      nonce: 'n1',
    } as never);

    const sign = lastSign(provider)!;
    expect(sign.method).toBe('signMessage');
    expect((sign.params as { message: { hex: string } }).message).toEqual({ hex: HELLO_HEX });
    expect((sign.params as { metaData: { purpose: string; domain?: string; nonce?: string } }).metaData).toEqual({
      purpose: 'sign-message',
      domain: 'example.com',
      nonce: 'n1',
    });

    expect(String(out.signature)).toBe('0xSIGNATURE');
    expect(String(out.partyId)).toBe('party::user');
    expect(out.message).toBe('Hello');
    expect(out.domain).toBe('example.com');
    expect(out.nonce).toBe('n1');
  });

  it('normalizes a { signature } OBJECT response too', async () => {
    const provider = recorder({ signature: '0xFROMOBJECT' });
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider,
      config: { signMessageHex: true },
    });
    const out = await adapter.signMessage(ctx, session('console'), { message: 'Hello' } as never);
    // no domain/nonce -> metaData carries only purpose
    expect((lastSign(provider)!.params as { metaData: object }).metaData).toEqual({ purpose: 'sign-message' });
    expect(String(out.signature)).toBe('0xFROMOBJECT');
    expect(out.message).toBe('Hello');
    expect(String(out.partyId)).toBe('party::user');
  });
});

// ── Send: MUST stay the raw string (no regression) ───────────────────────────
describe('Send (no flag): raw-string param unchanged; response normalized', () => {
  it('sends params.message as the RAW STRING (no hex, no metaData) and normalizes { signature }', async () => {
    const provider = recorder({ signature: '0xSENDSIG' });
    const adapter = new GenericAnnounceAdapter({
      announceId: SEND_ID,
      walletId: toWalletId('send'),
      provider,
      // NO signMessageHex
    });

    const out = await adapter.signMessage(ctx, session('send'), { message: 'Hello' } as never);

    const sign = lastSign(provider)!;
    // THE no-regression guard: Send's message is the raw string, NOT { hex }.
    expect(typeof (sign.params as { message: unknown }).message).toBe('string');
    expect((sign.params as { message: string }).message).toBe('Hello');
    expect((sign.params as { metaData?: unknown }).metaData).toBeUndefined();

    // Response still normalized to a full SignedMessage (additive for Send).
    expect(String(out.signature)).toBe('0xSENDSIG');
    expect(String(out.partyId)).toBe('party::user');
    expect(out.message).toBe('Hello');
  });
});

// ── Client-level: registry config → bridge → connect → signMessage works ─────
describe('client.signMessage via the announce bridge (Console, no ConsoleAdapter)', () => {
  beforeEach(() => discoverMock.mockReset());

  it('returns a valid SignedMessage (NOT InternalError) end to end', async () => {
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
      adapter: { type: '@partylayer/adapter-console', transport: 'announce', config: { restore: true, signMessageHex: true } },
    } as never);

    await client.listWallets({ includeExperimental: true }); // triggers bridge registration
    expect(client.getAdapter('console')).toBeInstanceOf(GenericAnnounceAdapter);

    await client.connect({ walletId: toWalletId('console') });
    const signed = await client.signMessage({ message: 'Hello' });

    // The bridge propagated signMessageHex:true → hex param reached the provider.
    expect((lastSign(provider)!.params as { message: { hex: string } }).message).toEqual({ hex: HELLO_HEX });
    // And the result is a valid SignedMessage, not InternalError.
    expect(String(signed.signature)).toBe('0xE2E');
    expect(signed.message).toBe('Hello');
    expect(String(signed.partyId)).toBe('party::user');

    client.destroy();
  });
});
