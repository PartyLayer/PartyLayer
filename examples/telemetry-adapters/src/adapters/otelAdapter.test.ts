/**
 * Unit test for the OpenTelemetry reference telemetry adapter.
 *
 * Verifies the adapter instantiates against the @opentelemetry/api no-op default (no host
 * SDK registered), maps at least two PartyLayerEvent types onto the active span (a track
 * event and an error), and forwards only primitive attributes.
 *
 * Privacy note: the adapter does not itself hash or strip party identifiers. The SDK event
 * telemetry bridge sanitizes properties before any adapter is called (see METRICS.md and
 * docs/observability.md). What the adapter guarantees, and what this test locks, is that it
 * adds no identifier of its own and drops any non primitive property value, so a structured
 * payload holding a raw party record cannot leak through as a span attribute.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trace } from '@opentelemetry/api';
import { createOtelAdapter } from './otelAdapter';

describe('createOtelAdapter', () => {
  it('instantiates the full TelemetryAdapter surface', () => {
    const adapter = createOtelAdapter();
    expect(typeof adapter.track).toBe('function');
    expect(typeof adapter.error).toBe('function');
    expect(typeof adapter.increment).toBe('function');
    expect(typeof adapter.gauge).toBe('function');
    expect(typeof adapter.flush).toBe('function');
    expect(adapter.isEnabled?.()).toBe(true);
  });

  it('is a safe no-op with no host SDK registered', () => {
    const adapter = createOtelAdapter();
    expect(() => {
      adapter.track('session:connected', { network: 'devnet' });
      adapter.error(new Error('boom'), { code: 'USER_REJECTED' });
      adapter.increment('sessions_created', 1);
      adapter.gauge('registry_age_ms', 42);
    }).not.toThrow();
  });

  describe('with an active span', () => {
    const addEvent = vi.fn();
    const recordException = vi.fn();
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEvent.mockReset();
      recordException.mockReset();
      spy = vi.spyOn(trace, 'getActiveSpan').mockReturnValue({
        addEvent,
        recordException,
      } as unknown as ReturnType<typeof trace.getActiveSpan>);
    });
    afterEach(() => spy.mockRestore());

    it('maps track to a span event with the event name and primitive attributes', () => {
      const adapter = createOtelAdapter();
      adapter.track('session:connected', { network: 'devnet', restored: true });
      expect(addEvent).toHaveBeenCalledTimes(1);
      expect(addEvent).toHaveBeenCalledWith('session:connected', {
        network: 'devnet',
        restored: true,
      });
    });

    it('maps error to recordException on the active span', () => {
      const adapter = createOtelAdapter();
      const err = new Error('rejected');
      adapter.error(err, { code: 'USER_REJECTED' });
      expect(recordException).toHaveBeenCalledWith(err);
    });

    it('forwards only primitive attributes and lets no structured party payload through', () => {
      const adapter = createOtelAdapter();
      adapter.track('tx:status', {
        status: 'committed',
        partyRecord: { id: 'raw::party::should-not-leak' },
      });
      const attributes = addEvent.mock.calls[0][1];
      expect(attributes).toEqual({ status: 'committed' });
      expect(JSON.stringify(attributes)).not.toContain('raw::party');
    });
  });
});
