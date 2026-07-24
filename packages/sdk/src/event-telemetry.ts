/**
 * Event to telemetry property mapping.
 *
 * The client routes every emitted {@link PartyLayerEvent} through the telemetry
 * adapter's `track` once, from the central emit path. This module is the single
 * place that decides which properties of each event are safe to send. It is pure
 * (no side effects, no client state) so the privacy rules can be tested in
 * isolation, and it is internal: it is NOT re-exported from the package entry, so
 * it adds nothing to the public API surface.
 *
 * Privacy is the hard constraint, per docs/METRICS.md and docs/EVENT_SPEC.md. Raw
 * party ids, session ids, transaction hashes, wallet urls, and any user identifying
 * value are NEVER included. Only non identifying fields pass through: wallet id,
 * network id or name, registry channel and sequence, a status, an error code, and a
 * change reason. The telemetry event name is the event's own `type` string.
 */
import type { PartyLayerEvent } from './events';

/** Pull a privacy safe error code from an error, if it carries one. */
function errorProperties(error: Error): Record<string, unknown> {
  const code = (error as { code?: string }).code;
  return code ? { code } : {};
}

/**
 * The privacy safe telemetry properties for an emitted event. Session ids, party
 * ids, transaction hashes, origins, and raw wallet payloads are deliberately left
 * out; where an event's only distinguishing field is such an identifier (for
 * example session disconnect or expiry), the properties are empty and the event
 * count itself is the signal.
 */
export function eventTelemetryProperties(event: PartyLayerEvent): Record<string, unknown> {
  switch (event.type) {
    case 'registry:updated':
      return { channel: event.channel, version: event.version };
    case 'registry:status':
      return {
        source: event.status.source,
        channel: event.status.channel,
        verified: event.status.verified,
        stale: event.status.stale,
        sequence: event.status.sequence,
      };
    case 'session:connected':
      return { walletId: event.session.walletId, network: event.session.network };
    case 'session:disconnected':
      return {};
    case 'session:expired':
      return {};
    case 'session:networkMismatch':
      return { expected: event.expected, actual: event.actual, enforced: event.enforced };
    case 'tx:status':
      return { status: event.status };
    case 'error':
      return errorProperties(event.error);
    case 'wallets:changed':
      return { reason: event.reason };
    default:
      return {};
  }
}
