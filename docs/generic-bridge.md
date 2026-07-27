# Adapterless CIP-0103 integration: the two generic paths

PartyLayer connects dApps to Canton wallets. You do not need a PartyLayer-specific
adapter package to be one of those wallets. There are exactly two generic paths, and
every CIP-0103 wallet fits one of them. Neither puts any wallet-specific code in the
PartyLayer codebase.

The sentence that matters most, stated once and plainly: **a wallet that already ships
an adapter for the wider Canton ecosystem is done. Nothing PartyLayer-specific is
required, only a registry entry.** If that describes you, skip to
[Path B](#path-b-discovery-adapter-remote-and-popup-wallets) for how the app hands your
adapter to PartyLayer, and to [the registry entry](#the-registry-entry) for the one
piece of metadata to add.

This guide is written for a wallet team we have never met. Read it once and you should
know which path is yours, what to implement, what to put in the registry, and that you
need nothing from us.

## The two paths, and how to tell which is yours

- **Path A, announce.** The wallet lives in the page: a browser extension that
  announces itself over `canton:announceProvider`. PartyLayer discovers it and drives
  it directly. No adapter object at all.
- **Path B, discovery adapter.** The wallet is a remote service or opens a popup, so it
  is not in the page to announce. The wallet ships its own adapter, an object satisfying
  the official `ProviderAdapter` shape, and the dApp hands that object to PartyLayer,
  which wraps it. This is the path for gateways, hosted wallets, and out-of-process
  desktop and mobile apps.

Decision guide: **if the wallet lives in the page, Path A; if it is a remote service or
opens a popup, Path B.**

### Which path each wallet shape takes

| Wallet shape | Path | Why |
| --- | --- | --- |
| Browser extension | A | It runs in the page, so it announces and PartyLayer drives it with no adapter object. |
| Remote or gateway service | B | It is out of the page, so it ships an official adapter and the dApp supplies it. Its `detect()` returns `true` because a gateway is always reachable. |
| Mobile wallet (deep link) | A or B | A deep link is how the wallet is opened, not a third path. If the wallet presents an in-page surface, Path A; if it is reached as a remote or gateway, Path B. |
| Desktop app | usually B | Typically reached as a local gateway or service, so Path B. Path A only if it injects into the page. |

A deep link is an installation and launch detail, not an integration path. A mobile
wallet still integrates through Path A or Path B like any other wallet; the deep link is
simply how its adapter brings the wallet to the foreground.

### A checklist a wallet team can work through

1. Decide your shape from the table above. That fixes your path.
2. Implement the CIP-0103 request methods you support. The baseline is `connect`,
   `signMessage`, and `prepareExecute`; the rest are additive.
3. Path A: announce over `canton:announceProvider`. Path B: ship a small package that
   exports an object satisfying the official `ProviderAdapter` shape.
4. Path B only: handle the remote concerns in
   [their own section](#remote-and-gateway-wallets-the-recurring-questions), namely
   popup policy, session survival, event streams, and origin validation.
5. Add a registry entry. It is optional on Path A and expected on Path B, and it is
   metadata only, no code.
6. Test against any dApp built on `@partylayer/sdk` (or the prebuilt `ConnectButton`).
7. There is no step seven. Nothing is required from PartyLayer.

---

## Path A: announce (in-page wallets)

Discovery follows the same pattern as EIP-6963 in Ethereum, adapted to Canton.

1. The dApp dispatches a `canton:requestProvider` event on `window`.
2. Each installed wallet replies with a `canton:announceProvider` event carrying its
   metadata.
3. PartyLayer collects the replies, deduplicates by stable id, and registers one adapter
   per wallet under the provider id `browser:ext:<id>`.

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
pick in the wallet list can only ever reach the wallet that announced it. The
implementation is `GenericAnnounceAdapter` in
[`packages/sdk/src/announce-adapter.ts`](../packages/sdk/src/announce-adapter.ts).

A wallet that PartyLayer already ships a first-party adapter for (for example Console)
is mapped to that adapter by id. Every other announcing CIP-0103 wallet is driven by the
generic announce adapter, with no code on our side.

### What a Path A wallet implements

Announce over `canton:announceProvider`, and implement these CIP-0103 request methods:

- `connect`: establish the session and return the connected party.
- `signMessage`: sign an arbitrary message.
- `prepareExecute`: prepare and submit a transaction (this is what a transfer maps to).

With just these, the wallet exposes three capabilities through PartyLayer: `connect`,
`signMessage`, and `submitTransaction`. That is a complete connect-and-transact surface,
adapterless.

Each of the following is feature-detected. Implement it and the matching capability
turns on; leave it out and the baseline is unaffected.

- `ledgerApi`: proxy Canton Ledger API reads and writes through the wallet. Adds the
  `ledgerApi` capability.
- `status` plus `getPrimaryAccount`: used for silent session restore on reload. Adds the
  `restore` capability.
- `txChanged` event: lets the dApp observe transaction status transitions. Adds the
  `events` capability.

### Capability mapping reference

| PartyLayer capability | CIP-0103 method(s) it calls | Baseline |
| --- | --- | --- |
| `connect`           | `connect` (plus `getPrimaryAccount`, `status`) | yes |
| `signMessage`       | `signMessage`        | yes |
| `submitTransaction` | `prepareExecute`     | yes |
| `ledgerApi`         | `ledgerApi`          | no  |
| `restore`           | `status`, `getPrimaryAccount` | no |
| `events`            | `txChanged`          | no  |

### Optional registry entry

A Path A wallet works with no registry presence at all. A small entry is additive: it
adds the wallet's name and icon to the picker and can opt the wallet into optional
capabilities declaratively, still with no code.

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

## Path B: discovery adapter (remote and popup wallets)

This is the path for a wallet that is not in the page to announce: a gateway, a hosted
wallet, a popup, a desktop or mobile app reached out of process. It carries equal weight
with Path A and is the right path for a large class of wallets.

### What the wallet ships

The wallet ships a small package that exports an object satisfying the official
`ProviderAdapter` shape from `@canton-network/core-wallet-discovery` (current release
1.8.0). There is no PartyLayer-specific package. Any standards-compliant Canton adapter
inherits this path, because PartyLayer matches the shape structurally rather than
importing any `@canton-network` package. The generic host is
`GenericDiscoveryAdapter` in
[`packages/sdk/src/discovery-adapter.ts`](../packages/sdk/src/discovery-adapter.ts); it
delegates every call to the provider your adapter returns.

### The ProviderAdapter members

Taken from the official interface, with what each member is for:

- `providerId`: stable id for the wallet. Aligns with the registry entry's `id`.
- `name`, `icon`: display in the wallet picker.
- `type`: one of `browser`, `desktop`, `mobile`, `remote`.
- `getInfo(): WalletInfo`: wallet metadata for the picker, including capabilities and the
  popup-policy flag described [below](#popup-policy).
- `detect(): Promise<boolean>`: whether the wallet is currently available. A gateway
  always returns `true`; an extension probes for itself.
- `provider(): Provider<DappRpcTypes>`: returns the provider that carries the RPC. A
  remote adapter may return a provider that bridges the remote API to the dApp API
  surface. The caller invokes `provider.request({ method: 'connect' })` and, later,
  `disconnect`.
- `teardown(): void`: clean up adapter-specific resources, for example closing popup
  windows. Called after disconnect; it does not itself call disconnect on the provider.
- `restore?(): Promise<Provider<DappRpcTypes> | null>`: optional. Attempt to reinstate a
  previous session, returning a ready-to-use provider or `null`. See
  [session survival](#session-survival) for how PartyLayer's bridge treats this.

### The provider shape, which is the crux

`Provider` has exactly four members:

- `request(args)`: the one you write. It dispatches an RPC call to the wallet.
- `on(event, listener)`, `emit(event, ...args)`, `removeListener(event, listener)`: event
  handling.

The official provider package ships an `AbstractProvider` base class that implements the
three event methods, so an implementer writes only `request`. A minimal remote adapter is
therefore short:

```ts
import { AbstractProvider } from '@canton-network/core-splice-provider';
import type { ProviderAdapter } from '@canton-network/core-wallet-discovery';

// Only request() is yours. on/emit/removeListener come from AbstractProvider.
class WalletXProvider extends AbstractProvider<DappRpcTypes> {
  async request({ method, params }) {
    // Dispatch to the wallet's own RPC. Reaching the gateway, opening and
    // validating the popup, and persisting the session are the wallet's business,
    // not PartyLayer's.
    return this.callWalletX(method, params);
  }
}

// The object the wallet ships and the app hands to PartyLayer.
export const walletXAdapter: ProviderAdapter = {
  providerId: 'walletx',
  name: 'Wallet X',
  type: 'remote',
  icon: 'https://walletx.example/icon.svg',
  getInfo() {
    return { /* WalletInfo: name, capabilities, reuseGlobalWalletPopup, ... */ };
  },
  detect() {
    return Promise.resolve(true); // a gateway is always reachable
  },
  provider() {
    return new WalletXProvider();
  },
  teardown() {
    // close the popup window this adapter opened
  },
  restore() {
    return Promise.resolve(null); // reinstate a saved session, or null
  },
};
```

Everything inside `request`, and how the adapter reaches its gateway, opens and validates
its popup, and persists a session, is the wallet's own business. PartyLayer only ever
calls `request({ method, params })`.

### How the dApp wires it

The dApp passes your adapter instance in the SDK config. The SDK detects the official
shape and wraps it through the generic discovery bridge automatically:

```ts
import { createPartyLayer } from '@partylayer/sdk';
import { walletXAdapter } from '@walletx/dapp-sdk';

const pl = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  adapters: [walletXAdapter], // wrapped by the generic discovery bridge
});
```

There are two supply forms. An instance with a host baked in at construction is used as
is. A factory form, `create(host)`, lets the SDK build the adapter with the host resolved
from the registry entry's `adapter.networkHosts` for the active network, which is how a
single registry entry serves devnet, testnet, and mainnet.

### The registry entry

For a discovery-adapter wallet the registry entry is expected, because it tells the dApp
which package to load and which host to use per network. Walley is the live example in
the stable registry (shown here as an example, not as the subject of this guide):

```jsonc
{
  "id": "walley",
  "name": "Walley",
  "adapter": {
    "type": "@k2flabs/walley-dapp-sdk",
    "transport": "discovery-adapter",
    "config": { "providerId": "walley" },
    "networkHosts": {
      "devnet": "https://dev.walley.cc",
      "testnet": "https://staging.walley.cc",
      "mainnet": "https://walley.cc"
    }
  },
  "cip0103": { "native": true }
}
```

- `adapter.type` names the wallet's own published package, not a PartyLayer package.
- `adapter.transport: "discovery-adapter"` routes the entry through the generic host.
- `adapter.networkHosts` supplies the per-network host for the factory form.

Walley's registry description states, in as many words, that there is no
PartyLayer-specific adapter package: it is bridged through its own
`@k2flabs/walley-dapp-sdk` adapter. That package (published at 1.1.0) depends on the
official discovery and provider packages, `@canton-network/core-wallet-discovery` and
`@canton-network/core-splice-provider`, and nothing from PartyLayer.

---

## Remote and gateway wallets: the recurring questions

Path B wallets share a set of concerns that in-page wallets do not. They are answered
factually here so a wallet team does not have to ask.

### Session survival

A page reload tears down the provider. The official `ProviderAdapter.restore` member
exists for this: a wallet may reinstate a previous session, for example from
`localStorage`, and return a ready-to-use provider or `null`.

PartyLayer's generic discovery bridge does not itself call `restore`. Instead the SDK
persists the session, gates it on the configured network on reload, and revives it, then
re-validates by re-probing the wallet with `status` and `getPrimaryAccount`. The
practical consequence for a wallet team: a discovery-adapter wallet survives a reload as
long as its provider answers `status` and `getPrimaryAccount` after the wallet is reached
again. Implementing `restore` in your adapter is harmless and useful for other Canton
hosts, but it is `status` and `getPrimaryAccount` that PartyLayer relies on.

### Popup policy

A wallet declares `reuseGlobalWalletPopup` on its `WalletInfo`. When set, the wallet
picker keeps its global popup open after the user picks, so the wallet can reuse it for
asynchronous navigations. The documented case for this is an HTTP wallet gateway; it is
not used for synchronous dApp-API wallets even when `type` is `remote`.

The practical constraint is the browser's user-gesture requirement: a popup opens only
from the synchronous call stack of a user action. PartyLayer's connect path is built to
reach the wallet's `provider()` and the popup with no awaits in front of it, so the popup
survives the gesture. Your adapter must not insert an `await` before it opens the popup,
or the browser will block it.

### Event streams

Remote wallets often deliver status over a stream. If the server does not attach event
ids, a client cannot resume with `Last-Event-ID` after a dropped connection, because
there is no cursor to resume from. The correct behavior is to re-read state after a
reconnect rather than assume the stream continued uninterrupted. PartyLayer's discovery
bridge does not depend on a wallet emitting events at all; it never reports the `events`
capability for a discovery-adapter wallet, and it re-probes state rather than trusting
continuity.

### Origin validation

A popup that returns its result to the opener by `postMessage` must validate both the
event `origin` and the `source` window before trusting the message. Validate `origin`
against the exact expected wallet origin, and confirm `source` is the popup window the
adapter opened. This belongs in the wallet's adapter, because that is where the popup is
opened and where the expected origin and window reference are known. Getting it wrong is
not cosmetic: any window that can post to the opener, including an unrelated page or a
malicious frame, could otherwise supply a forged result and the opener would accept it as
the wallet's answer.

---

## CIP-0103 method coverage

The bridge speaks the standard CIP-0103 surface, and it is **identical on both paths**.
A wallet implements CIP-0103 once; whether PartyLayer reaches it by announce or by
discovery adapter does not change the method set.

- Requests: `connect`, `disconnect`, `isConnected`, `status`, `getActiveNetwork`,
  `listAccounts`, `getPrimaryAccount`, `signMessage`, `prepareExecute`, `ledgerApi`.
- Events: `statusChanged`, `accountsChanged`, `txChanged`, `connected`.

A wallet does not need all of these. The baseline three, `connect`, `signMessage`, and
`prepareExecute`, are enough to be usable; the rest are additive.

---

## A note on the five wallets with a PartyLayer-specific adapter

The stable registry today has eight wallets: two on announce (Console, Send), one on the
discovery adapter (Walley), and five with no declared transport that still ship a
PartyLayer-specific adapter package (5N Loop, Cantor8, Bron, Nightly, WalletConnect).

Read plainly, that list could suggest that writing a PartyLayer-specific package is the
expected route. It is not, and reading it that way has already cost an external
contributor real work. Those five predate the generic paths and exist for historical
reasons. New wallets should not follow that pattern: they should use Path A or Path B and
ship no PartyLayer-specific code.

A wallet already shipping a PartyLayer-specific adapter can move to a generic path. In
practice that means announcing over `canton:announceProvider` (Path A) or shipping an
official `ProviderAdapter` and switching its registry entry to
`adapter.transport: "discovery-adapter"` with the package under `adapter.type` (Path B),
after which the PartyLayer-specific package is no longer needed.

---

## Scope and limits

The generic bridge normalizes the connection handshake and the call surface: one API
mapped to each wallet's CIP-0103 methods, on either path, with no per-wallet code.

What neither path does is change how a wallet marshals commands internally. If a wallet's
own prepare or submit path diverges from the spec, for example decoding a `TextMap`
choice context as a record, that is a wallet-side fix and is independent of the bridge.
The bridge delivers the correct, spec-shaped payload to the wallet either way.

Neither path invents capabilities a wallet does not have. Capabilities are feature-
detected and reported truthfully, so a dApp checks `session.capabilitiesSnapshot` before
relying on an optional one. The discovery bridge in particular never reports `events`,
because popup and remote wallets expose the event surface but do not emit.

---

## How Ethereum settled the same shape

The same two-path shape is where Ethereum's ecosystem landed, which is worth one
paragraph as context. In-page wallets are discovered through EIP-6963 and driven by a
single injected connector, the direct analogue of Path A. Remote wallets go through one
shared protocol rather than a package per wallet, the analogue of Path B. RainbowKit
additionally ships a generic fallback entry so that a remote wallet absent from its
curated list still works, which is the idea proposed below.

---

## Choosing a path

If the wallet lives in the page, Path A: announce, implement the baseline CIP-0103
methods, and optionally add a registry entry. If the wallet is a remote service or opens
a popup, Path B: ship an official `ProviderAdapter`, let the dApp supply it, and add a
registry entry with `transport: "discovery-adapter"`.

And once more, because it is the point of this document: **a wallet that already ships an
adapter for the wider Canton ecosystem is done. Nothing PartyLayer-specific is required,
only a registry entry.**

---

## Proposal, not shipped: a generic fallback picker entry

This section is a proposal, not a current feature.

Following RainbowKit's generic fallback, PartyLayer could show a single generic entry in
the wallet picker for any wallet that supplies an official `ProviderAdapter` but is absent
from our registry. A user with such a wallet could then connect without waiting for a
registry entry to land.

What it would take: a picker entry that accepts an app-supplied official adapter with no
matching registry `id`, resolves its host from the adapter rather than from
`networkHosts`, and labels the entry generically. It is not implemented today, and this
document does not claim otherwise. A discovery-adapter wallet is surfaced today through
its registry entry, as [above](#the-registry-entry).
