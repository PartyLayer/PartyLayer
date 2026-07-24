/**
 * Structured logging tests.
 *
 * Covers: silent by default (nothing printed with no logger), level filtering, the
 * `silent` level, one structured line per emitted event with the expected name and
 * level, the privacy rule (no raw party id, session id, transaction hash, or origin
 * in any payload), correlation ids (present, stable within one operation, distinct
 * across operations), and plain `console` compatibility.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoggerAdapter } from '@partylayer/core';

// createPartyLayer pulls the Console adapter transitively; stub its SDK.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Offline registry so connect fails fast and deterministically (no network).
vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>(
    '@partylayer/registry-client',
  );
  const core = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');
  class OfflineRegistryClient {
    async getWallets() { return []; }
    async listWallets() { return []; }
    async getWalletEntry(id: string) { throw new core.WalletNotFoundError(id); }
    async getRegistry() { return { wallets: [], metadata: {} }; }
    async refreshRegistry() { return { wallets: [], metadata: {} }; }
    getStatus() { return { state: 'offline', lastFetchAt: null, lastError: null }; }
    onStatusChange() { return () => {}; }
  }
  return { ...actual, RegistryClient: OfflineRegistryClient };
});

import { createPartyLayer } from './index';
import type { PartyLayerEvent } from './events';
import { newCorrelationId, eventLogLevel } from './logging';

interface LogCall {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  payload: Record<string, unknown>;
}

function spyLogger() {
  const calls: LogCall[] = [];
  const record = (level: LogCall['level']) => (message: string, payload?: unknown) =>
    calls.push({ level, message, payload: (payload ?? {}) as Record<string, unknown> });
  const logger: LoggerAdapter = {
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
  return { logger, calls };
}

// Identifying values that MUST NEVER reach a log payload.
const PARTY = 'party::secret-abc';
const SESSION = 'sess::secret-def';
const TXHASH = 'tx::deadbeef';
const ORIGIN = 'https://secret-dapp.example.com';

const EVENTS: PartyLayerEvent[] = [
  { type: 'registry:updated', channel: 'stable', version: '7' } as PartyLayerEvent,
  {
    type: 'registry:status',
    status: { source: 'network', verified: true, channel: 'stable', sequence: 7, stale: false, fetchedAt: 1 },
  } as PartyLayerEvent,
  {
    type: 'session:connected',
    session: { sessionId: SESSION, walletId: 'console', partyId: PARTY, network: 'devnet', createdAt: 1, origin: ORIGIN, capabilitiesSnapshot: [] },
  } as unknown as PartyLayerEvent,
  { type: 'session:disconnected', sessionId: SESSION } as unknown as PartyLayerEvent,
  { type: 'session:expired', sessionId: SESSION } as unknown as PartyLayerEvent,
  { type: 'session:networkMismatch', sessionId: SESSION, expected: 'canton:devnet', actual: 'canton:mainnet', enforced: true } as unknown as PartyLayerEvent,
  { type: 'tx:status', sessionId: SESSION, txId: TXHASH, status: 'submitted', raw: { secret: PARTY } } as unknown as PartyLayerEvent,
  { type: 'error', error: Object.assign(new Error('boom ' + PARTY), { code: 'USER_REJECTED' }) } as PartyLayerEvent,
  { type: 'wallets:changed', reason: 'announced' } as PartyLayerEvent,
];

function makeClient(opts: { logger?: LoggerAdapter; logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent' } = {}) {
  return createPartyLayer({ network: 'devnet', app: { name: 'test' }, ...opts });
}

function emit(client: unknown, event: PartyLayerEvent, correlationId?: string): void {
  (client as { emit: (t: string, p: PartyLayerEvent, c?: string) => void }).emit(event.type, event, correlationId);
}

describe('silent by default', () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = [];
  beforeEach(() => {
    for (const m of ['debug', 'info', 'warn', 'error'] as const) {
      spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
    }
  });
  afterEach(() => {
    for (const s of spies) s.mockRestore();
    spies.length = 0;
  });

  it('prints nothing when no logger is configured', () => {
    const client = makeClient();
    for (const s of spies) s.mockClear();
    for (const event of EVENTS) emit(client, event);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});

describe('level filtering', () => {
  it('delivers the configured level and above, nothing below', () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'warn' });
    emit(client, EVENTS.find((e) => e.type === 'session:connected')!); // info
    emit(client, EVENTS.find((e) => e.type === 'registry:status')!); // debug
    emit(client, EVENTS.find((e) => e.type === 'session:networkMismatch')!); // warn
    emit(client, EVENTS.find((e) => e.type === 'error')!); // error
    const levels = calls.map((c) => c.level);
    expect(levels).not.toContain('debug');
    expect(levels).not.toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
  });

  it('suppresses everything at silent', () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'silent' });
    for (const event of EVENTS) emit(client, event);
    expect(calls).toHaveLength(0);
  });
});

describe('one structured line per event', () => {
  it('emits exactly one line named by the event type at its mapped level', () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'debug' });
    for (const event of EVENTS) {
      calls.length = 0;
      emit(client, event);
      expect(calls).toHaveLength(1);
      expect(calls[0].level).toBe(eventLogLevel(event.type));
      expect(calls[0].payload.event).toBe(event.type);
    }
  });
});

describe('privacy', () => {
  it('never carries a raw party id, session id, transaction hash, or origin', () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'debug' });
    for (const event of EVENTS) emit(client, event);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(PARTY);
    expect(serialized).not.toContain(SESSION);
    expect(serialized).not.toContain(TXHASH);
    expect(serialized).not.toContain(ORIGIN);
  });
});

describe('correlation ids', () => {
  it('newCorrelationId returns a short non identifying id that differs each call', () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it('threads an explicit correlation id into the log payload, and omits it when absent', () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'debug' });
    calls.length = 0;
    emit(client, EVENTS.find((e) => e.type === 'session:connected')!, 'cid-123');
    const withId = calls.find((c) => c.payload.event === 'session:connected');
    expect(withId?.payload.correlationId).toBe('cid-123');
    calls.length = 0;
    emit(client, EVENTS.find((e) => e.type === 'session:connected')!);
    const withoutId = calls.find((c) => c.payload.event === 'session:connected');
    expect(withoutId?.payload).not.toHaveProperty('correlationId');
  });

  it('is stable within one operation and differs across two', async () => {
    const { logger, calls } = spyLogger();
    const client = makeClient({ logger, logLevel: 'debug' });

    // A failing connect (no wallet) still logs connect:start and the error event,
    // both under the connect operation's single correlation id.
    calls.length = 0;
    await client.connect().catch(() => {});
    const start1 = calls.find((c) => c.payload.event === 'connect:start');
    const cid1 = start1?.payload.correlationId;
    expect(cid1).toMatch(/^[0-9a-f]{12}$/);
    // The error logged during the same connect shares the id (stable within one op).
    expect(calls.some((c) => c.payload.event === 'error' && c.payload.correlationId === cid1)).toBe(true);

    calls.length = 0;
    await client.connect().catch(() => {});
    const cid2 = calls.find((c) => c.payload.event === 'connect:start')?.payload.correlationId;
    expect(cid2).toMatch(/^[0-9a-f]{12}$/);
    expect(cid2).not.toBe(cid1); // differs across two operations
  });
});

describe('console compatibility', () => {
  it('accepts plain console as the logger', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const client = makeClient({ logger: console, logLevel: 'debug' });
    expect(() => emit(client, EVENTS.find((e) => e.type === 'session:connected')!)).not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith('session:connected', expect.objectContaining({ event: 'session:connected' }));
    infoSpy.mockRestore();
  });
});
