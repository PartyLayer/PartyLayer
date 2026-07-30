# Event to lifecycle phase mapping

> Published on the docs site as a section of [partylayer.xyz/docs/events](https://partylayer.xyz/docs/events#event-phase-mapping).

The observability deliverable names six lifecycle phases: connect, authorize, prepare,
submit, confirm, and error. The shipped SDK does not emit six phase named events. It emits
nine domain events on the `PartyLayerEvent` union (`packages/sdk/src/events.ts`), and the
phases are a reading of those events, not a separate event set. This table is the mapping,
so an operator instrumenting by phase knows exactly which event to watch.

## The nine shipped events and their phase

| Shipped event | Lifecycle phase | Mapping |
|---|---|---|
| `session:connected` | connect | The terminal event of a connect: a wallet session is established. |
| `session:disconnected` | connect | The connect teardown, the inverse of a connect. |
| `wallets:changed` | connect | A pre connect discovery signal: the listable wallet set changed, so the picker re reads before a connect. |
| `registry:updated` | connect | Setup within connect: a new registry channel or version loaded before wallets are listed. |
| `registry:status` | connect | Setup and health within connect: fetch source, verification, and staleness. Its `error` field feeds the error phase when set. |
| `tx:status` | prepare, submit, confirm | The single transaction lifecycle event. Its `status` field is the phase: a pending or prepared status is prepare, submitted is submit, committed is confirm. |
| `session:expired` | error | An error class condition: the session is no longer valid and the dApp must reconnect. |
| `session:networkMismatch` | error | An error class condition: the wallet is on the wrong network, enforced under the guard or strict policy. |
| `error` | error | The dedicated error phase event. |

## Phases with no dedicated event

Three of the six phases have no event of their own. They are covered by an existing event,
and this is by design, not an omission.

- **authorize** is covered by `session:connected`. CIP-0103 folds authorization into the
  connect grant: the wallet's approval to connect is the authorization, so there is no
  separate authorize step and no separate event.
- **prepare**, **submit**, and **confirm** are covered by `tx:status`. The kit models the
  transaction lifecycle as one event whose `status` field moves through prepared,
  submitted, and committed, rather than three separately named events. Instrument the phase
  by branching on `status`.

The connect phase is covered by `session:connected` and `session:disconnected`, and the
error phase by `error`, with `session:expired` and `session:networkMismatch` as further
error class conditions.

See [the event specification](./EVENT_SPEC.md) for each event's full payload, and
[observability](./observability.md) for the vendor neutral telemetry bridge that consumes
these events.
