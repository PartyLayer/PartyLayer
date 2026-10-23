# PartyLayer: CIP-0103 alignment and compatibility limits

## Standard and evidence

The [Canton Foundation CIP-0103 specification](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
defines the provider request/event contract, synchronous and asynchronous flows,
and error semantics. Its linked versioned API artifacts remain the authority;
PartyLayer's local types and fixtures are implementation evidence, not a replacement
for the specification. Review date: 2026-10-23.

CIP-0103 covers the API of a provider. Announcing and selecting among multiple
providers is outside that CIP's discovery scope. PartyLayer's default catalog,
registry policy and ConnectButton provide the application integration around it.
See [Architecture](./architecture.md) and [Protocol ownership](./protocol-ownership.md).

## Current integration paths

The recommended React entry point is `PartyLayerKit` with `ConnectButton`. It uses
`PartyLayerClient`, shared generic CIP-0103 bridges and existing proprietary
compatibility integrations. Wallet runtimes are included in the default install;
new wallets do not require another PartyLayer adapter package.

The direct `@partylayer/provider` wrapper forwards an attached provider's requests
and events, including its supported asynchronous user-URL flows. It cannot create
capabilities the underlying wallet or deployment has disabled.

`client.asProvider()` is a stable facade over the official browser-native owner
for native connections, with real account metadata, raw Ledger API forwarding and
genuine provider events. Existing proprietary integrations use the compatibility
bridge. `createProviderBridge(client)` explicitly retains that legacy bridge for
all clients. Neither surface certifies full wallet-independent conformance.

## Method behavior

For native browser connections, `client.asProvider()` forwards the wallet
account, network, status, execution and Ledger API methods directly. Message
signing keeps the reviewed SDK encoding/normalization policy. Lifecycle calls
use the one official connection owner. The table describes the explicit legacy
`createProviderBridge` and compatibility integrations; its limits do not apply
to raw native account/ledger passthrough.


| Method | Direct provider | Client compatibility bridge |
| --- | --- | --- |
| `connect`, `disconnect`, `isConnected` | Delegates/orchestrates the wallet connection | Uses the public client's connection and validated session |
| `status` | Wallet status | Derived SDK status; no authoritative wallet access token is supplied |
| `getActiveNetwork` | Wallet network | Active session network; disconnected calls reject instead of inventing Devnet |
| `listAccounts`, `getPrimaryAccount` | Wallet-authorized account information | Projects one active session party; unknown public keys and full account enumeration are unavailable |
| `signMessage` | Wallet signing request/result | Public client signing; application authentication separately verifies exact bytes and independently authorized party keys |
| `prepareExecute` | Wallet execution flow | Uses combined submission when sign-only is absent; separate signing only for that capability, with the same-session check before submission |
| `ledgerApi` | Forwards the attached wallet's response | Existing SDK contract returns `{ response: string }` and supports its documented method/resource/body fields |

The current legacy Ledger API response wrapper is different from the standard's
raw JSON Ledger API response. Its shared request type also does not yet model all
standard path/query/header fields. The SDK 0.20 native `asProvider()` facade returns raw JSON and forwards path,
query and headers. Consumers migrating native reads must stop parsing
`result.response`; `client.ledgerApi()` and `createProviderBridge` retain the
existing wrapper. See [Storage and API migration](./protocol-ownership.md#storage-and-api-migration). See [Wallet balances](./wallet-balances.md) for supported
SDK reads and the node-version-specific complete-snapshot requirements.

## Transaction evidence

A transaction hash is not a signature, a command ID is not a ledger update ID,
and an acknowledgement is not ledger completion. The bridge never substitutes
those values for one another. It preserves a caller's command ID, or generates
one for the request and passes it into the submitted command payload. Concurrent
requests with the same pending command ID are rejected without another wallet write.

A `signed` event requires an actual signature, reported signer and party.
A complete `executed` event requires an actual update ID and nonnegative safe
integer completion offset. Receipts may omit those fields; missing evidence is
never filled with empty strings or offset zero. A ledger-reported offset of zero
is preserved as data, rather than synthesized as a default.

A lost submission response has an unknown outcome. The bridge rejects the RPC
without inventing a terminal failed event or replaying the write. Explicit user or
transaction rejection and failures before submission can produce a failed event. Genuine
wallet status events are forwarded only when their required payload fields exist.
A combined-only wallet must not receive a separate sign-only call first.

`useTransactionFlow` supplies the richer application UI lifecycle and independent
read-only reconciliation. See [Transaction lifecycle](./transaction-lifecycle.md).
Message-signature success does not demonstrate a valid transfer or protocol-specific
swap; those require ledger acceptance with valid commands and authorized funding.

## Events, accounts and asynchronous flows

The direct wrapper and native facade forward supported wallet events. Native
account/status changes revalidate the SDK identity; writes are blocked during
refresh. The explicit compatibility bridge derives
status/account events from SDK sessions, while transaction events depend on
actual available evidence. Its single account projection cannot establish a
verified public key or complete wallet account list. It is not a substitute for
native account/network subscriptions.

Some hosted wallets expose an event-shaped API but never emit account/network
changes. Their generic integration must not advertise working events on that
basis. Reconnect/refresh and validate current identity where those signals are
unavailable. The current compatibility bridge also does not implement the full
asynchronous server user-URL protocol; use a verified direct/official client path
for that deployment model.

## Errors and responsibilities

Provider-facing errors use numeric `ProviderRpcError` codes. Unsupported methods
remain unsupported; transport failures do not authorize automatic write retries.
Wallets own signing authorization, private keys and network credentials.
Applications own valid commands, holdings/history authorization, backend login
verification and ledger outcome correlation. PartyLayer must report actual
capabilities and results rather than imply universal wallet functionality.

## Validation and remaining migration

Automated checks cover provider shape, numeric errors, controlled transaction
payloads, combined-only routing, stale sessions, no duplicate writes and rejection
of fabricated/incomplete event evidence. The installed official WalletConnect
runtime is also checked without opening a real relay session. These checks do not
certify every wallet or deployment against the external normative specification.

The native conformance runner currently exercises an in-repository reference
provider. Browser-dependent compatibility suites and live wallet/ledger tests are
separate. The candidate native owner/account/ledger migration has controlled integration
coverage. Final packed/runtime/browser release checks, complete live account-change
acceptance, accessibility and wallet/ledger acceptance remain open. Track them in [Platform roadmap](./platform-roadmap.md),
[Protocol ownership](./protocol-ownership.md) and [Release process](./releasing.md).
