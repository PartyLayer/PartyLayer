# Canton protocol ownership decision

Status: implemented in the unpublished SDK 0.20 candidate for browser-native
announce/injected and official ProviderAdapter connections. Release and live-wallet
acceptance remain open. Review baseline: `@canton-network/core-wallet-discovery`
**1.15.0**, Canton dApp SDK **1.8.0**, 2026-10-23.

## Decision

One official Canton `DiscoveryClient` owns the active native provider and native
connection. PartyLayer owns approved runtime loading, registry policy, announced
metadata, branded UI, boundary validation and reactive application views. Existing
proprietary/custom adapters and the published WalletConnect compatibility wrapper
retain their supported contracts outside this native owner.

There is no new wallet-specific PartyLayer package, private vendor-field access or
second independently restored native identity. The official client is loaded from
its public package entry point during preparation. A prepared connect reaches the
wallet's connect RPC synchronously in the user's click stack.

## Reviewed public interfaces

The public `DiscoveryClient` supplies registration, wallet metadata, connect,
disconnect, active session/provider, restoration and destroy. PartyLayer uses those
methods, rather than the combined SDK's private discovery field. Canton dApp SDK
1.8.0's combined `DappSDK` still exposes no public destroy/discovery accessor.
Announced metadata registration remains PartyLayer policy; standalone
`DiscoveryClient` does not automatically listen for announce events.

The official handshake alone does not reject explicit `isConnected: false` or an
empty primary party. PartyLayer validates them before the official client commits.
Overlapping native operations are rejected without invalidating the first approval.
Timeout/abort stops the local wait even when a vendor ignores cancellation, and late
results cannot replace a new connection. Silent restore/account probes are bounded
at ten seconds. Account/network events refresh the live identity; writes are blocked
while that identity is being refreshed. Empty accounts and disconnected status end
the SDK session instead of restoring it from an old cache.
After native message approval, a fresh primary-party/network probe prevents a bare
signature from being attributed to an old account in an eventless wallet. This is
an identity consistency check, not independent cryptographic signature verification.

Destroy removes subscriptions and locally tears down transport resources without
issuing a wallet logout. Explicit disconnect uses the official lifecycle. React
construction defers external subscriptions until the committed effect, and effect
replay keeps the committed client/store alive.

The public official extension transport was also reviewed. Its current request wait
has no timeout/cleanup handle; its public provider does not expose the notification
unsubscribe, and its message validator does not verify window source/origin. We
retain PartyLayer's bounded, source/origin-checked target channel for announced
extensions instead of adopting a cleanup/security regression. It is one generic
transport, pooled per target, with genuine target-scoped notifications and explicit
destroy. No official extension transport runs alongside it. Revisit this boundary
when the vendor exposes the required lifecycle and message guarantees.

## Current compatibility versions

WalletConnect's existing compatibility integration uses reviewed dApp SDK **1.8.0**.
Walley **1.2.0** declares a dApp SDK **^0.24.0** peer, explicitly provided as **0.24.0**.
Cauri **0.2.0** requires core types **^1.7.0**; the SDK provides **1.14.0**, while the
new discovery engine resolves its own **2.1.0** dependency. These peer contracts are
isolated; replacing all of them with one latest major would be incompatible.
Daily dependency PRs propose reviewed updates and do not auto-approve new versions.
No version pin establishes live wallet, relay or ledger acceptance.

## Storage and API migration

The official owner persists its provider-ID hint. PartyLayer's existing
`active_session` cache is only a constrained UI projection: native restoration
requires that official owner plus a live matching primary party, network policy,
origin and expiry. A legacy native cache with no official hint is discarded and
requires one explicit reconnect. Failed probes never display a cached connected
party. A disconnect blocks any in-flight cache read from reviving it before the
serialized removal finishes. OneSwap still requires a fresh explicit connection.

React's shared session store defaults to an in-memory derived view, not another
persisted native identity. Explicit custom storage remains a non-authoritative
view cache; it never proves application login or wallet authorization.

`client.asProvider()` is now one stable facade. Native account methods expose real
wallet accounts and key metadata. Native Ledger API requests forward standard
path/query/header fields and return the raw wallet response. Native execution and
transaction events delegate to that provider; no fabricated lifecycle fields are
added. Message signing retains the reviewed encoding/normalization boundary,
including Console's registry-declared base64 encoding.

`createProviderBridge(client)` remains an explicit compatibility API, as do
`client.ledgerApi()` and existing SDK ledger hooks returning `{ response: string }`.
Applications moving a native `asProvider().request({ method: 'ledgerApi' })` call
from the old bridge must consume the raw JSON response directly instead of parsing
`result.response`. The compatibility bridge still projects one active party with
unknown key fields; it does not enumerate a native wallet's accounts. A missing
native account-list method remains unsupported, not an invented account list.
Party/network selection uses the wallet's documented interface; the kit does not
invent a universal CIP setter or automatic signing on mount.

## Migration and release gates

Controlled tests exercise the installed official discovery runtime, public SDK and
announced extension channel: negative handshakes, empty accounts, aborts, duplicate
clicks, changed restored identity, account/network/disconnect events, exact ledger
forwarding, real account metadata, compatibility switching, cleanup and StrictMode.
These are automated integration evidence, not vendor certification.

Before publication, pass the complete workspace/packed ESM/CommonJS/SSR/Next/Vite
and browser gates on the final commit. Complete the deferred wallet/ledger matrix,
review accessibility and the versioned migration guidance, then publish/verify the
coordinated package set and deployment. Async server user-URL orchestration and
proprietary native replacements need their own verified paths. The bridge does not
provide universal application-login verification or ledger outcome reconciliation.
See [Platform roadmap](./platform-roadmap.md) and [Release process](./releasing.md).
