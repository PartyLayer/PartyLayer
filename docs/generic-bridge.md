# PartyLayer Generic Bridge: Adapterless CIP-0103 Integration

PartyLayer connects dApps to Canton wallets. Historically each wallet needed its own
first-party adapter. The generic bridge removes that: any wallet that implements
CIP-0103 and announces itself is picked up through a single code path, with no
wallet-specific adapter package to write or maintain. New CIP-0103 wallets light up
the moment they announce.

This guide covers both sides:

- For wallets: how to be discovered and driven by PartyLayer with zero adapter code.
- For dApps: how to connect to any CIP-0103 wallet through one API.

A note on scope up front: the bridge normalizes the connection handshake and the
call surface (one API mapped to each wallet's CIP-0103 methods). It does not rewrite
a wallet's internal Daml-LF marshalling. If a wallet diverges from the spec inside
its own prepare or submit path, that is still fixed on the wallet side.

---

## How it works: the announce handshake

Discovery follows the same pattern as EIP-6963 in Ethereum, adapted to Canton.

1. The dApp dispatches a `canton:requestProvider` event on `window`.
2. Each installed wallet replies with a `canton:announceProvider` event carrying its
   metadata.
3. PartyLayer collects the replies, deduplicates by stable id, and registers one
   adapter per wallet under the provider id `browser:ext:<id>`.

The announce payload is:

```ts
interface AnnouncedWallet {
  id: string;       // stable provider id (the extension id)
  name?: string;    // display name shown in the wallet picker
  icon?: string;    // data: URI or URL
  target?: string;  // routing key for the extension postMessage channel
}
```

`target` is the channel the bridge talks to. When omitted it defaults to `id`, so an
announce with no explicit target still routes to the announcing wallet's own channel,
never a shared or last-one-wins slot. Because every call is scoped to that channel, a
pick in the wallet list can only ever reach the wallet that announced it.

A wallet that PartyLayer already ships a first-party adapter for (for example Console)
is mapped to that adapter by id. Every other announcing CIP-0103 wallet is driven by
the generic adapter described below, with no code on our side.

---

## For wallets: be discovered with zero adapter code

To work through the generic bridge, a wallet implements the CIP-0103 dApp Standard
and announces over `canton:announceProvider`. There is nothing PartyLayer-specific to
build.

### Required for the baseline

Announce over `canton:announceProvider`, and implement these CIP-0103 request methods:

- `connect`: establish the session and return the connected party.
- `signMessage`: sign an arbitrary message.
- `prepareExecute`: prepare and submit a transaction (this is what a transfer maps to).

With just these, the wallet exposes three capabilities through PartyLayer:
`connect`, `signMessage`, and `submitTransaction`. That is a complete connect-and-transact
surface, adapterless.

### Optional, additive

Each of these is feature-detected. Implement it and the matching capability turns on;
leave it out and the baseline is unaffected.

- `ledgerApi`: proxy Canton Ledger API reads and writes through the wallet. Enabling
  this adds the `ledgerApi` capability.
- `status` plus `getPrimaryAccount`: used for silent session restore on reload.
  Enabling these adds the `restore` capability.
- `txChanged` event: lets the dApp observe transaction status transitions. Enabling
  this adds the `events` capability.

### Capability mapping reference

| PartyLayer capability | CIP-0103 method(s) it calls | Baseline |
| --- | --- | --- |
| `connect`           | `connect` (+ `getPrimaryAccount`, `status`) | yes |
| `signMessage`       | `signMessage`        | yes |
| `submitTransaction` | `prepareExecute`     | yes |
| `ledgerApi`         | `ledgerApi`          | no  |
| `restore`           | `status`, `getPrimaryAccount` | no |
| `events`            | `txChanged`          | no  |

### Optional registry entry

A wallet works adapterless with no registry presence at all. A small registry entry
is purely additive: it adds the wallet's name and icon to the picker and can opt the
wallet into optional capabilities declaratively, still with no code.

```jsonc
{
  "name": "Your Wallet",
  "icon": "https://...",
  "capabilities": { "events": true },
  "adapter": { "transport": "announce" },
  "cip0103": { "native": true }
}
```

- `adapter.transport: "announce"` routes the entry through the generic announce path.
- `cip0103.native: true` is the canonical marker that the wallet speaks CIP-0103.
- `capabilities` and any `adapter.config` flags enable the optional surface above.

---

## For dApps: connect to any CIP-0103 wallet

You write one API. The bridge maps it to whichever wallet the user picks, so you do
not maintain a separate payload per wallet.

```ts
import { createPartyLayer } from '@partylayer/sdk';

const pl = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});

// The picker lists every announcing CIP-0103 wallet, plus any first-party ones.
const session = await pl.connect();

// session.capabilitiesSnapshot reflects what the connected wallet actually
// supports, so feature-detect before relying on an optional capability.
if (session.capabilitiesSnapshot.includes('ledgerApi')) {
  // ledgerApi is available on this wallet
}
```

From the connected client you use the same `connect`, `signMessage`,
`submitTransaction`, and `ledgerApi` calls no matter which wallet answered. See the
Quick Start guide for the full call signatures.

React projects can use the prebuilt `ConnectButton` and `PartyLayerKit`; both list
the same set of announced wallets automatically, and new CIP-0103 wallets appear in
the picker as they ship, with no change to your app.

---

## CIP-0103 method coverage

The bridge speaks the standard CIP-0103 surface. For reference, the methods and
events it understands:

- Requests: `connect`, `disconnect`, `isConnected`, `status`, `getActiveNetwork`,
  `listAccounts`, `getPrimaryAccount`, `signMessage`, `prepareExecute`, `ledgerApi`.
- Events: `statusChanged`, `accountsChanged`, `txChanged`, `connected`.

A wallet does not need all of these. The baseline three (`connect`, `signMessage`,
`prepareExecute`) plus the announce are enough to be usable; the rest are additive.

---

## Scope and limits

The generic bridge gives a uniform, adapterless connect-and-transact surface across
CIP-0103 wallets, and grows wallet coverage without per-wallet code. What it
standardizes is the payload shape and the call surface.

What it does not do is change how a wallet marshals commands internally. If a wallet's
own prepare or submit path diverges from the spec, for example decoding a
`TextMap` choice context as a record, that is a wallet-side fix and is independent of
the bridge. The bridge will deliver the correct, spec-shaped payload to the wallet
either way.
