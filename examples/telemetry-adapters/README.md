# PartyLayer Telemetry Adapters Example

A minimal Vite plus React app showing how PartyLayer events reach a telemetry
adapter, with two reference adapters you can copy.

## What it shows

- A console adapter (zero dependencies) implementing the full `TelemetryAdapter`
  surface, keeping the last N records in memory and rendering them in a live table.
- An OpenTelemetry adapter that bridges the same surface onto `@opentelemetry/api`
  only. The host application registers an OpenTelemetry SDK; without one the API is a
  no-op by design, so the adapter is safe to wire either way.
- Both adapters fanned together as the client's telemetry, so the same events reach
  the table and OpenTelemetry at once.

Every emitted PartyLayer event reaches the adapter through one central bridge, named
by its type string, with privacy-safe properties only. See
[docs/observability.md](../../docs/observability.md) for the full guide, and
[docs/EVENT_SPEC.md](../../docs/EVENT_SPEC.md) and
[docs/METRICS.md](../../docs/METRICS.md) for the contracts.

## Files

- `src/adapters/consoleAdapter.ts` the zero-dependency reference adapter.
- `src/adapters/otelAdapter.ts` the OpenTelemetry bridge (API only).
- `src/partylayer.ts` the client wiring, fanning both adapters into the telemetry slot.
- `src/components/EventTable.tsx` the live table over the console adapter.

## Prerequisites

A registry server is optional. With one running the wallet list read succeeds on
load; without one the failure still surfaces as a telemetry record, so the table
populates either way.

```bash
# Optional, from the PartyLayer root
cd apps/registry-server
pnpm build
pnpm start
```

## Run

```bash
# From the PartyLayer root
cd examples/telemetry-adapters
pnpm install
pnpm dev
```

Open the printed URL. The table fills as events flow: a registry record on load, then
connection and session records when you connect a wallet.

## Configuration

Copy `.env.example` to `.env` and adjust if needed:

- `VITE_REGISTRY_URL` registry server URL (default `http://localhost:3001`)
- `VITE_REGISTRY_CHANNEL` channel, `stable` or `beta` (default `stable`)
- `VITE_NETWORK` network, `devnet`, `testnet`, or `mainnet` (default `devnet`)

## Using OpenTelemetry for real

`src/adapters/otelAdapter.ts` uses only `@opentelemetry/api`. To send data to a
backend, register an OpenTelemetry SDK (a `MeterProvider` and `TracerProvider`) in
your host application. Until you do, the API returns no-op instruments and the adapter
records nothing, which is the intended vendor-neutral default.
