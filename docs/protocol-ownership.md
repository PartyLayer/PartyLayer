# Canton protocol ownership decision

Status: target accepted for the next protocol migration; not implemented by the
default catalog release. Review baseline: published `@canton-network/dapp-sdk`
**1.8.0** and `@canton-network/core-wallet-discovery` **1.14.0**, 2026-10-23.

## Decision

Use one official Canton discovery/provider/session owner for native CIP-0103
connections. PartyLayer should own the developer entry point, registry policy,
branded UI, reactive projections and application integration boundaries. Keep
existing proprietary compatibility integrations outside the native protocol
owner until a verified native replacement exists.

Do not introduce another per-wallet PartyLayer npm package, deep-import vendor
internals, or run two independently persisted native connection states.
The current generic bridges and `PartyLayerClient` remain the released contract
until the migration below has its own implementation and acceptance evidence.

## Reviewed public interfaces

The [official published SDK](https://www.npmjs.com/package/@canton-network/dapp-sdk/v/1.8.0)
exports these interfaces through its public entry point:

| Interface | Available contract | Migration consequence |
| --- | --- | --- |
| `DiscoveryClient` | Adapter registration, wallet listing, connect/disconnect, active session/provider, restoration, events and destroy | Suitable public lifecycle boundary; PartyLayer may project its state but must not independently restore a second native session |
| `DappClient` | Connected-provider RPC calls and subscriptions | Use for native requests; it is not a discovery engine |
| `DappSDK` | Combined initialization, announced-wallet handling, connections, RPC and events | In 1.8.0 it exposes no public destroy or discovery-client accessor; do not read private fields to manufacture a lifecycle API |
| `ExtensionAdapter`, `RemoteAdapter`, `WalletConnectAdapter` | Official transport/provider adapters | Prefer verified public transports over copying transport behavior into new wallet-specific integrations |

Automatic announced-wallet registration is implemented inside `DappSDK` in this
baseline. It is not an implicit feature of a standalone `DiscoveryClient`.
Selecting only that class therefore does not, by itself, migrate announced
wallet discovery. Account/transaction event semantics and teardown must be
verified together with the selected public client, including React StrictMode.

The official discovery handshake does not remove PartyLayer's responsibility to
reject explicit `isConnected: false`, missing primary parties, invalid signatures
or stale results. Keep those trust-boundary checks without duplicating protocol
state. Server authentication still needs independently authorized party keys;
the official client does not supply a universal application-login verifier.

## Current compatibility versions

WalletConnect uses reviewed dApp SDK **1.8.0**, loaded dynamically. Walley's
**1.2.0** runtime declares a dApp SDK **^0.24.0** peer; the default SDK explicitly
provides **0.24.0** for that compatibility path. These versions are deliberately
separate. Replacing the peer with 1.8.0 would violate the vendor's published
contract. The demo no longer declares an unrelated top-level old SDK.

This compatibility dependency does not establish a second official native owner;
the current implementation still uses PartyLayer orchestration. Daily dependency
PRs are review candidates. A new Walley peer contract and clean npm/runtime checks
are required before removing its old dependency. Other legacy integrations need
their own API review; upgrading one SDK does not prove all vendor SDKs are current.

## Migration and release gates

1. Select a public official client with complete announce, injected, remote and
   WalletConnect discovery and a supported cleanup lifecycle. Resolve the 1.8.0
   public-lifecycle gap before making a combined SDK the default.
2. Prove the native engine independently with controlled providers: restored
   party/network validation, account/network/disconnect events, duplicate clicks,
   late approvals, storage ordering, expiry and StrictMode cleanup. Exercise the
   installed official runtime as well as controlled test doubles.
3. Make the official active provider/session the native source of truth. Keep
   PartyLayer's session hooks a derived view; migrate or discard old saved hints
   without resurrecting an unverified native session. Test reload and migration
   from the currently published storage format.
4. Route native RPC/actions and genuine provider events through that owner.
   Preserve Console's documented signing encoding and every supported vendor
   envelope. Expose actual primary/account information; do not synthesize unknown
   public keys or a selectable account list from one cached party.
5. Keep existing proprietary integrations in a clearly marked compatibility
   boundary. Require verified native equivalents before removing them, or use an
   explicit documented breaking release. Existing custom adapters must retain a
   supported migration path.
6. Publish API/storage migration guidance, packed npm/ESM/CommonJS/SSR/Next/Vite
   evidence, complete live wallet/ledger acceptance and a rollback plan. Switch
   the default only after those checks pass. Keep application authentication and
   transaction outcome correlation independent of cached UI state.

The [platform roadmap](./platform-roadmap.md) tracks this work separately from the
one-command catalog and UI features. This decision records the ownership target
and migration criteria; it does not certify completed protocol parity or replace
the deferred live wallet tests.
