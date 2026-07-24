/**
 * Structured logging helpers for the client.
 *
 * The client follows the library convention that a kit stays SILENT unless the
 * application opts in: with no logger configured it prints nothing. When a logger is
 * supplied, the client filters by level CENTRALLY here and in one private `log`
 * method, so adapters never implement filtering themselves and every log line carries
 * a structured, machine readable payload.
 *
 * This module is internal: it is NOT re-exported from the package entry, so it adds
 * nothing to the public API surface beyond the `logLevel` config field.
 *
 * Privacy is the hard constraint, the same rules as telemetry (see docs/METRICS.md):
 * no raw party ids, session ids, transaction hashes, or origins appear in any log
 * payload. The safe fields for emitted events come from `eventTelemetryProperties`,
 * reused rather than duplicated.
 */
import type { PartyLayerEvent } from './events';

/** Configured verbosity. `silent` suppresses everything. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** A level a message can actually be emitted at (`silent` is only a threshold). */
export type EmittableLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** Whether a message at `level` clears the configured `threshold`. */
export function shouldLog(level: EmittableLevel, threshold: LogLevel): boolean {
  if (threshold === 'silent') return false;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[threshold];
}

/**
 * A short, non identifying correlation id for tracing one operation end to end.
 * Browser safe (uses Web Crypto when present, falls back otherwise) and never derived
 * from party or session data, so two concurrent operations get distinct ids.
 */
export function newCorrelationId(): string {
  const scope = (typeof globalThis !== 'undefined' ? globalThis : {}) as { crypto?: Crypto };
  if (scope.crypto && typeof scope.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    scope.crypto.getRandomValues(bytes);
    let hex = '';
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
    return hex;
  }
  return Math.random().toString(16).slice(2, 14).padStart(12, '0');
}

/**
 * The log level for an emitted event. Errors log at error; network mismatch logs at
 * warn; the primary session lifecycle logs at info; the higher volume or lower signal
 * events (registry status, transaction status, expiry, wallet list changes) log at
 * debug.
 */
export function eventLogLevel(type: PartyLayerEvent['type']): EmittableLevel {
  switch (type) {
    case 'error':
      return 'error';
    case 'session:networkMismatch':
      return 'warn';
    case 'session:connected':
    case 'session:disconnected':
      return 'info';
    case 'registry:status':
    case 'registry:updated':
    case 'session:expired':
    case 'tx:status':
    case 'wallets:changed':
      return 'debug';
    default:
      return 'info';
  }
}
