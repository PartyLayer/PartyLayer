# Observability on PartyLayer

PartyLayer is vendor neutral about telemetry. It defines a small adapter interface,
ships one reference implementation, and forwards every event it emits to whatever
adapter you plug in. It never talks to a specific backend, so you choose the vendor
and keep the privacy guarantees. This guide covers what exists, how to write an
adapter for your vendor, what stays private, how a dApp instruments its own token
standard reads and writes, and the current limits stated honestly.

---

## What exists

- `TelemetryAdapter` (from `@partylayer/core`): the vendor-neutral interface every
  adapter implements.
- `MetricsTelemetryAdapter` (from `@partylayer/sdk`, with `createTelemetryAdapter`):
  a privacy-safe reference adapter that buffers canonical metric counters and can
  post them to a backend.
- The canonical metric counters (connect attempts and successes, sessions created and
  restored, restore attempts, registry fetch and cache and stale, error by code).
- The event to track bridge: since it landed, every emitted `PartyLayerEvent` reaches
  the adapter's `track()` once, named by its type string, with privacy-safe
  properties, from one central path in the client.

The contracts live in two documents, and this guide does not restate their tables.
See [EVENT_SPEC.md](./EVENT_SPEC.md) for the event payloads, the event to metric
mapping, and the Event telemetry bridge property table; see [METRICS.md](./METRICS.md)
for the canonical metric names and the Event Track Counters section.

---

## How to write a vendor adapter

An adapter is an object with two required methods and four optional ones:

- `track(event, properties?)` (required): a named event with optional properties.
- `error(error, properties?)` (required): an error occurrence.
- `increment(metric, value?)` (optional): a counter.
- `gauge(metric, value)` (optional): a point-in-time value.
- `flush()` (optional): push buffered data to the backend.
- `isEnabled()` (optional): whether collection is on.

The client feature-detects the optional methods, so an adapter that implements only
`track` and `error` is complete. Map each method onto your vendor's primitives. The
rows below are a starting point; consult each vendor's current API for exact calls.

| Method | OpenTelemetry | Sentry | Datadog |
|--------|---------------|--------|---------|
| `track`     | counter add, or span event on the active span | breadcrumb, or a captured message | increment a metric, or submit an event |
| `error`     | record the exception on the active span, or an error counter | capture the exception | increment an error metric, or submit an event |
| `increment` | counter add | a metric increment | increment |
| `gauge`     | observable gauge | a metric gauge | gauge |
| `flush`     | force flush on the SDK provider (the API alone is a no-op) | flush the client | flush the buffer |
| `isEnabled` | whether a provider is registered | whether the client is initialized | whether the agent is configured |

For working code, see the [telemetry adapters example](../examples/telemetry-adapters):
a zero-dependency console adapter that renders records live, and an OpenTelemetry
bridge built on `@opentelemetry/api` only. The OpenTelemetry adapter is a no-op until
the host application registers an OpenTelemetry SDK, which is the point of depending on
the API package alone: the kit stays vendor neutral and the host owns the backend.

---

## Privacy

The adapter surface carries only privacy-safe values. The bridge never sends raw party
ids, session ids, transaction hashes, or origins; where an event's only distinguishing
field is such an identifier, the property set is empty and the event count is the
signal. The full per-event property set is the table in EVENT_SPEC.md.

Telemetry is opt in. When no adapter is configured the client uses a default no-op
telemetry and the bridge is skipped, so an unconfigured app behaves exactly as before
with no overhead. Your own adapter should honor the same rule: keep it disabled by
default and gate sending behind explicit configuration.

Where an identifier is genuinely needed for correlation, hash it with core's
`hashForPrivacy` rather than sending it raw. Today the bridge sends none, so this
matters mainly for properties you add yourself in your own instrumentation.

---

## Instrumenting the token standard path

The CIP-0056 hooks (`useTokenHoldings`, `useTransferInstructions`,
`useTokenAllocations`, `useAllocationRequests`, and the write hooks) are Model 2: they
import only TanStack Query and the query keys, and they deliberately hold no client.
They wrap a read or submit fetcher that the dApp supplies. Because they have no client,
they cannot and should not emit telemetry themselves. Instrumenting the ledger read and
write path is the dApp's concern, by design, not a gap in the kit.

The natural place to measure duration and outcome is the fetcher the dApp already
passes in. Wrap it once and record through your own adapter:

```ts
import type { TelemetryAdapter } from '@partylayer/core';

function instrumented<T>(
  name: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  telemetry: TelemetryAdapter,
) {
  return async (signal?: AbortSignal): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fetcher(signal);
      telemetry.gauge?.(`${name}_ms`, Date.now() - start);
      telemetry.track(`${name}:ok`, {});
      return result;
    } catch (err) {
      telemetry.error(err as Error, { op: name });
      throw err;
    }
  };
}

// Then pass the wrapped fetcher to the hook:
//   useTokenHoldings({ read: instrumented('holdings', myReadFetcher, telemetry), ... })
```

The same wrap applies to a submit fetcher passed to `useChoice` or the typed write
hooks. Keep the recorded properties non-identifying, exactly as the bridge does.

---

## Known limits

Stated honestly, so nobody mistakes these for solved:

- The client emits `tx:status` for `pending` and `submitted` only. It reports these
  from its own request path and does not subscribe to the wallet's transaction status
  stream (the CIP-0103 `txChanged` event), so `committed`, `rejected`, and `failed`
  do not reach telemetry yet.
- The internal status mapping never produces `rejected`; it yields pending, submitted,
  committed, or failed. So even once a subscription is wired, `rejected` needs its own
  handling.

Both are tracked as separate work. Until then, treat transaction lifecycle telemetry
as covering initiation, not settlement.

---

## See also

- [Event Specification](./EVENT_SPEC.md)
- [Metrics and Telemetry](./METRICS.md)
- [Privacy-aware reads on Canton](./privacy-and-reads.md)
- [Telemetry adapters example](../examples/telemetry-adapters)
