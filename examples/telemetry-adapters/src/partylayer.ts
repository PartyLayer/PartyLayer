/**
 * PartyLayer client wiring for the telemetry example.
 *
 * Builds a client with telemetry enabled. Every emitted PartyLayer event reaches the
 * telemetry adapter's `track()` named by its type string, with privacy-safe
 * properties. Here the telemetry slot is a small fan-out over BOTH reference
 * adapters, so the same events reach the console adapter (which the UI renders) and
 * the OpenTelemetry adapter (a no-op until the host registers an OTel SDK).
 */
import { createPartyLayer } from '@partylayer/sdk';
import type { PartyLayerClient } from '@partylayer/sdk';
import type { TelemetryAdapter } from '@partylayer/core';
import { createOtelAdapter } from './adapters/otelAdapter';
import type { ConsoleTelemetryAdapter } from './adapters/consoleAdapter';

/** Fan a single telemetry stream out to several adapters. */
function composeTelemetry(...adapters: TelemetryAdapter[]): TelemetryAdapter {
  return {
    track(event, properties) {
      for (const a of adapters) a.track(event, properties);
    },
    error(error, properties) {
      for (const a of adapters) a.error(error, properties);
    },
    increment(metric, value) {
      for (const a of adapters) a.increment?.(metric, value);
    },
    gauge(metric, value) {
      for (const a of adapters) a.gauge?.(metric, value);
    },
    flush() {
      return Promise.all(adapters.map((a) => a.flush?.() ?? Promise.resolve())).then(() => undefined);
    },
    isEnabled() {
      return adapters.some((a) => a.isEnabled?.() ?? true);
    },
  };
}

/**
 * Create the example client. The console adapter is passed in so the caller keeps a
 * reference for the UI; the OpenTelemetry adapter is created here and fanned in.
 */
export function createClient(consoleAdapter: ConsoleTelemetryAdapter): PartyLayerClient {
  const registryUrl = import.meta.env.VITE_REGISTRY_URL || 'http://localhost:3001';
  const channel = (import.meta.env.VITE_REGISTRY_CHANNEL || 'stable') as 'stable' | 'beta';
  const network = (import.meta.env.VITE_NETWORK || 'devnet') as 'devnet' | 'testnet' | 'mainnet';

  return createPartyLayer({
    registryUrl,
    channel,
    network,
    app: {
      name: 'Telemetry Adapters Example',
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
    telemetry: composeTelemetry(consoleAdapter, createOtelAdapter()),
  });
}
