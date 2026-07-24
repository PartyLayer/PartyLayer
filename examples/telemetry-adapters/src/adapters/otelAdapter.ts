/**
 * OpenTelemetry reference telemetry adapter (@opentelemetry/api ONLY).
 *
 * Bridges the PartyLayer TelemetryAdapter surface onto OpenTelemetry using only the
 * API package, never an SDK. The HOST APPLICATION is responsible for registering an
 * OpenTelemetry SDK (a MeterProvider and TracerProvider). Without a registered SDK
 * the @opentelemetry/api package returns no-op meters and tracers BY DESIGN, so this
 * adapter is a safe no-op until the host wires a real SDK. That separation is the
 * whole point of the API-only dependency: the kit stays vendor neutral and the host
 * chooses the backend.
 *
 * Mapping:
 * - track     to a counter (`partylayer.events`) plus a span event on the active span
 * - error     to `recordException` on the active span plus an error counter
 * - increment to a per-metric counter
 * - gauge     to a per-metric observable gauge
 * - flush     to a no-op; `forceFlush` lives on the SDK MeterProvider, not the API
 * - isEnabled to true; real gating is decided by whether the host registered an SDK
 */
import {
  metrics,
  trace,
  type Counter,
  type Meter,
  type ObservableGauge,
  type ObservableResult,
} from '@opentelemetry/api';
import type { TelemetryAdapter } from '@partylayer/core';

/** Keep only primitive attribute values; OpenTelemetry attributes are primitives. */
function toAttributes(properties?: Record<string, unknown>): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {};
  if (!properties) return attributes;
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attributes[key] = value;
    }
  }
  return attributes;
}

/** An OpenTelemetry-backed TelemetryAdapter. */
export function createOtelAdapter(name = 'partylayer', version = '0.1.0'): TelemetryAdapter {
  const meter: Meter = metrics.getMeter(name, version);
  const tracer = trace.getTracer(name, version);

  const eventCounter: Counter = meter.createCounter('partylayer.events', {
    description: 'Count of PartyLayer events, by event type.',
  });
  const errorCounter: Counter = meter.createCounter('partylayer.errors', {
    description: 'Count of PartyLayer errors, by error code.',
  });

  const counters = new Map<string, Counter>();
  const gauges = new Map<string, { instrument: ObservableGauge; value: number }>();

  const counterFor = (metric: string): Counter => {
    let counter = counters.get(metric);
    if (!counter) {
      counter = meter.createCounter(metric);
      counters.set(metric, counter);
    }
    return counter;
  };

  return {
    track(event, properties) {
      eventCounter.add(1, { event, ...toAttributes(properties) });
      // Reference the tracer so a host with a TracerProvider attaches a span event.
      trace.getActiveSpan()?.addEvent(event, toAttributes(properties));
      void tracer;
    },
    error(error, properties) {
      const code = (error as { code?: string }).code ?? error.name ?? 'error';
      errorCounter.add(1, { code, ...toAttributes(properties) });
      trace.getActiveSpan()?.recordException(error);
    },
    increment(metric, value = 1) {
      counterFor(metric).add(value);
    },
    gauge(metric, value) {
      let entry = gauges.get(metric);
      if (!entry) {
        const instrument = meter.createObservableGauge(metric);
        entry = { instrument, value };
        instrument.addCallback((result: ObservableResult) => {
          result.observe(gauges.get(metric)?.value ?? 0);
        });
        gauges.set(metric, entry);
      }
      entry.value = value;
    },
    flush() {
      // No-op: the API has no flush. A host that wants to force a flush calls
      // forceFlush on its own SDK MeterProvider/TracerProvider.
      return Promise.resolve();
    },
    isEnabled() {
      return true;
    },
  };
}
