/**
 * Console reference telemetry adapter (ZERO dependencies).
 *
 * A demonstrably working reference implementation of the full TelemetryAdapter
 * surface from @partylayer/core. It keeps an in-memory ring buffer of the last N
 * records and exposes a subscribe/getEntries pair so a UI can render them live. Wire
 * it into the client with `telemetry: createConsoleAdapter()` and every emitted
 * PartyLayer event reaches `track()` named by its type string, with the privacy-safe
 * properties the event bridge already applies.
 *
 * This adapter only records what it is given. It never reads client state and never
 * adds identifiers of its own, so the privacy guarantees of the bridge hold end to
 * end.
 */
import type { TelemetryAdapter } from '@partylayer/core';

/** One recorded telemetry call. */
export interface TelemetryEntry {
  /** Which adapter method produced this record. */
  kind: 'track' | 'error' | 'increment' | 'gauge';
  /** Event type, error code, or metric name. */
  name: string;
  /** Privacy-safe properties or a numeric value, when present. */
  properties?: Record<string, unknown>;
  /** When it was recorded (ms since epoch). */
  timestamp: number;
}

/** The console adapter plus the read surface a UI needs. */
export interface ConsoleTelemetryAdapter extends TelemetryAdapter {
  /** The buffered entries, most recent last. */
  getEntries(): TelemetryEntry[];
  /** Subscribe to buffer changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Empty the buffer. */
  clear(): void;
}

/**
 * Create a console telemetry adapter that buffers the last `capacity` records.
 */
export function createConsoleAdapter(capacity = 50): ConsoleTelemetryAdapter {
  let entries: TelemetryEntry[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const record = (entry: TelemetryEntry) => {
    entries = [...entries, entry].slice(-capacity);
    notify();
  };

  const errorCode = (error: Error): string =>
    (error as { code?: string }).code ?? error.name ?? 'error';

  return {
    track(event, properties) {
      record({ kind: 'track', name: event, properties, timestamp: Date.now() });
    },
    error(error, properties) {
      record({ kind: 'error', name: errorCode(error), properties, timestamp: Date.now() });
    },
    increment(metric, value = 1) {
      record({ kind: 'increment', name: metric, properties: { value }, timestamp: Date.now() });
    },
    gauge(metric, value) {
      record({ kind: 'gauge', name: metric, properties: { value }, timestamp: Date.now() });
    },
    flush() {
      // Nothing to send: this adapter is in-memory only.
      return Promise.resolve();
    },
    isEnabled() {
      return true;
    },
    getEntries() {
      return entries;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      entries = [];
      notify();
    },
  };
}
