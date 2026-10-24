# Open findings

Verified defects that are **not fixed** and **not scheduled**. Each entry says
what reproduces, on what commit it was checked, and what would have to happen to
close it.

## Why this file exists

A defect written up only in a report is a defect that gets rediscovered. Two of
the entries below came from an external consumer who found them because nothing
in the tree said they were known.

The sharper reason is #6. Work already in flight touches the same subject and
will look, when it lands, as though it closed this. It does not. A register is
how "we fixed the neighbouring thing" stops reading as "we fixed it".

**An entry leaves this file when the defect is fixed, not when it is explained.**
If you are about to add reasoning to an entry rather than remove it, that is the
signal it should have a decision made instead.

---

## 2. No way to observe an in-progress wait

**Reproduces** on `55ff8d1`. The client emits `session:connected`,
`session:disconnected`, `session:expired`, `session:networkMismatch`,
`wallets:changed`, `tx:status` and `error`. There is no pending or progress
event. `phase` appears only inside **error** payloads — after the fact, on
failure.

A consumer can learn that a wait failed and where. It cannot ask what is being
waited on now. `#326` bounded the connect deadline at 120s, which is a different
question: bounded is not observable.

**What would close it** is an event we have not designed. Our event surface is
public API, so this needs a defined vocabulary and stable semantics rather than a
debug hook bolted on — which is why it is not a patch.

## 4. Presence is established on one channel, connect is attempted on another

**Reproduces** on `55ff8d1` as a code path; **no failure is observable today**,
for the reason in the trigger below.

This was tracked all session as "the `continue` discards resolved announce
targets". That label was wrong, and it is renamed here because the old name
described the mechanism and hid the consequence. Nothing is lost by discarding
the target — what is wrong is that the picker and the connect path can be reading
different channels.

**What happens.** In `listWallets` (`packages/sdk/src/client.ts`), an announced
provider that matches a KNOWN wallet takes `continue` — correctly, since the
registry entry already lists it and a second entry would be a duplicate row. The
resolved `d.provider` and `d.id` are dropped at that point. The registered
adapter then obtains a provider by its own means, and the means differ:

| Adapter | How it reaches its provider | Effect |
| --- | --- | --- |
| **Nightly** | reads `window.nightly.canton`, an injected global | announce proves presence, connect uses a different channel |
| **Console** | does not listen for announce either | same divergence |
| **Send** | listens for announce ITSELF (`waitForProvider`) and binds `{ target: match.id }` | unaffected — it re-derives exactly what was discarded, at the cost of a duplicate wait |

So Send pays a latency cost and is otherwise correct. Nightly and Console are the
two where the evidence and the action come from different places.

**The trigger, for whoever hits this.** A wallet that ANNOUNCES BUT DOES NOT
INJECT will appear in the picker and then fail to connect. The picker believed it
because the announce event arrived; the adapter then looked for a window global
that was never set. If you are debugging a wallet that is visible, clickable, and
throws "not found" or "not installed" on connect — while you can see its announce
event in the console — this entry is your defect.

It does not reproduce today only because both extensions currently do inject. That
is a property of two shipped extensions, not of our code, and it can change
without us being told.

**What would close it** is handing the already-resolved provider to the
registered adapter instead of letting it re-acquire one. There is no way to do
that without changing the adapter contract — adapters have no channel to receive a
live provider — which makes this the HEAVIEST of the defects found in this batch,
not the lightest its old name suggested. That is why it is recorded rather than
fixed: a contract change is not justified by a failure nobody can currently
produce, but the moment one is produced, this is the shape of the fix.

---

## Recently closed, for contrast

Kept briefly so the register shows the difference between "explained" and
"fixed".

- **Console probe conflated timeout with absence** — `#335`. The vendor resolves
  `notInstalled` on a 1000ms timeout and caches it for the page; our `unknown`
  branch sat in a `catch` the vendor never triggers, so it never ran.
- **Loop discarded the transaction outcome and declared a false `events`
  capability** — `#336`.
