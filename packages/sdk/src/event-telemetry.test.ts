/**
 * Event to telemetry bridge tests.
 *
 * Covers the pure property mapping (each event type, privacy safe fields only), the
 * central emit bridge (every emitted event produces exactly one track call named by
 * the event type), the privacy guarantee (no raw party id, session id, or
 * transaction hash reaches any telemetry property), the unconfigured no-op, and that
 * the existing increment call sites still fire.
 */
import { describe, it, expect, vi } from 'vitest';
import type { TelemetryAdapter } from '@partylayer/core';
import { eventTelemetryProperties } from './event-telemetry';
import type { PartyLayerEvent } from './events';
import { createPartyLayer } from './client';

// Identifying values that MUST NEVER appear in telemetry properties.
const PARTY = 'party::secret-abc123';
const SESSION = 'sess::secret-def456';
const TXHASH = 'tx::deadbeefcafe';
const ORIGIN = 'https://secret-dapp.example.com';

// One representative payload per event type, each seeded with identifying values.
const EVENTS: PartyLayerEvent[] = [
  { type: 'registry:updated', channel: 'stable', version: '7' } as PartyLayerEvent,
  {
    type: 'registry:status',
    status: { source: 'network', verified: true, channel: 'stable', sequence: 7, stale: false, fetchedAt: 1 },
  } as PartyLayerEvent,
  {
    type: 'session:connected',
    session: {
      sessionId: SESSION,
      walletId: 'console',
      partyId: PARTY,
      network: 'devnet',
      createdAt: 1,
      origin: ORIGIN,
      capabilitiesSnapshot: [],
    },
  } as unknown as PartyLayerEvent,
  { type: 'session:disconnected', sessionId: SESSION, reason: 'user' } as unknown as PartyLayerEvent,
  { type: 'session:expired', sessionId: SESSION } as unknown as PartyLayerEvent,
  {
    type: 'session:networkMismatch',
    sessionId: SESSION,
    expected: 'canton:devnet',
    actual: 'canton:mainnet',
    enforced: true,
  } as unknown as PartyLayerEvent,
  { type: 'tx:status', sessionId: SESSION, txId: TXHASH, status: 'submitted', raw: { secret: PARTY } } as unknown as PartyLayerEvent,
  { type: 'error', error: Object.assign(new Error('boom with ' + PARTY), { code: 'USER_REJECTED' }) } as PartyLayerEvent,
  { type: 'wallets:changed', reason: 'announced' } as PartyLayerEvent,
];

describe('eventTelemetryProperties', () => {
  it('maps each event type to its privacy safe property set', () => {
    const byType = Object.fromEntries(EVENTS.map((e) => [e.type, eventTelemetryProperties(e)]));
    expect(byType['registry:updated']).toEqual({ channel: 'stable', version: '7' });
    expect(byType['registry:status']).toEqual({
      source: 'network',
      channel: 'stable',
      verified: true,
      stale: false,
      sequence: 7,
    });
    expect(byType['session:connected']).toEqual({ walletId: 'console', network: 'devnet' });
    expect(byType['session:disconnected']).toEqual({});
    expect(byType['session:expired']).toEqual({});
    expect(byType['session:networkMismatch']).toEqual({
      expected: 'canton:devnet',
      actual: 'canton:mainnet',
      enforced: true,
    });
    expect(byType['tx:status']).toEqual({ status: 'submitted' });
    expect(byType['error']).toEqual({ code: 'USER_REJECTED' });
    expect(byType['wallets:changed']).toEqual({ reason: 'announced' });
  });

  it('omits the error code when the error has none', () => {
    expect(eventTelemetryProperties({ type: 'error', error: new Error('plain') } as PartyLayerEvent)).toEqual({});
  });

  it('never leaks a raw party id, session id, transaction hash, or origin', () => {
    for (const event of EVENTS) {
      const serialized = JSON.stringify(eventTelemetryProperties(event));
      expect(serialized).not.toContain(PARTY);
      expect(serialized).not.toContain(SESSION);
      expect(serialized).not.toContain(TXHASH);
      expect(serialized).not.toContain(ORIGIN);
    }
  });
});

/** A spy TelemetryAdapter capturing track/increment calls. */
function spyTelemetry() {
  const track = vi.fn();
  const increment = vi.fn();
  const adapter: TelemetryAdapter = { track, error: vi.fn(), increment };
  return { adapter, track, increment };
}

/** Reach the client's private emit for a focused test of the central bridge. */
function emit(client: unknown, event: PartyLayerEvent): void {
  (client as { emit: (type: string, payload: PartyLayerEvent) => void }).emit(event.type, event);
}

describe('client emit to telemetry bridge', () => {
  it('produces exactly one track call named by the event type, per event', () => {
    const { adapter, track } = spyTelemetry();
    const client = createPartyLayer({ network: 'devnet', app: { name: 'test' }, telemetry: adapter });
    for (const event of EVENTS) {
      track.mockClear();
      emit(client, event);
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith(event.type, eventTelemetryProperties(event));
    }
  });

  it('sends no identifying value in any tracked property, across every event', () => {
    const { adapter, track } = spyTelemetry();
    const client = createPartyLayer({ network: 'devnet', app: { name: 'test' }, telemetry: adapter });
    for (const event of EVENTS) emit(client, event);
    const serialized = JSON.stringify(track.mock.calls);
    expect(serialized).not.toContain(PARTY);
    expect(serialized).not.toContain(SESSION);
    expect(serialized).not.toContain(TXHASH);
    expect(serialized).not.toContain(ORIGIN);
  });

  it('is a no-op with no telemetry configured: emitting still reaches handlers and does not throw', () => {
    const client = createPartyLayer({ network: 'devnet', app: { name: 'test' } });
    const seen: string[] = [];
    client.on('wallets:changed', () => seen.push('handled'));
    expect(() => emit(client, { type: 'wallets:changed', reason: 'announced' } as PartyLayerEvent)).not.toThrow();
    expect(seen).toEqual(['handled']);
  });

  it('still increments the error metric from the emit path (existing call site preserved)', () => {
    const { adapter, increment, track } = spyTelemetry();
    const client = createPartyLayer({ network: 'devnet', app: { name: 'test' }, telemetry: adapter });
    emit(client, { type: 'error', error: Object.assign(new Error('x'), { code: 'TIMEOUT' }) } as PartyLayerEvent);
    expect(increment).toHaveBeenCalledWith('error_TIMEOUT');
    expect(track).toHaveBeenCalledWith('error', { code: 'TIMEOUT' });
  });
});
