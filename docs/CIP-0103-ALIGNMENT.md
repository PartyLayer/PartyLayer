# PartyLayer: CIP-0103 dApp Standard Alignment

## 1. Purpose & Scope

CIP-0103 defines a standard interface for communication between decentralized applications (dApps) and wallet providers on the Canton Network. By establishing a shared contract, the Provider interface, CIP-0103 enables any dApp to interact with any compliant wallet without wallet-specific integration code. This standardization is foundational for a healthy Canton ecosystem: it lowers the barrier to entry for wallet developers, reduces integration burden for dApp developers, and makes network usage measurable across the ecosystem.

PartyLayer adopted CIP-0103 as its canonical Provider interface for three reasons:

1. **Interoperability**: dApps using PartyLayer can work with any CIP-0103-compliant wallet without adaptation layers.
2. **Ecosystem alignment**: CIP-0103 is the Canton Foundation's chosen standard for dApp-wallet communication. Aligning with it positions PartyLayer as a spec-compliant participant in the ecosystem rather than a proprietary alternative.
3. **Ecosystem observability**: Standardized method calls and events provide the observable primitives needed for measuring network usage without injecting proprietary telemetry.

This document describes PartyLayer's alignment with CIP-0103. It is not a restatement of the CIP itself. Readers should consult the [CIP-0103 specification](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md) for the authoritative standard.

---

## 2. Provider Architecture Overview

PartyLayer's CIP-0103 implementation lives in the `@partylayer/provider` package. The architecture separates three concerns:

```
                     dApp
                      |
                      v
        +----------------------------+
        |    CIP-0103 Provider       |     <-- Standard interface
        |    Interface               |         (request, on, emit,
        |                            |          removeListener)
        +----------------------------+
           |                    |
           v                    v
  +-----------------+   +------------------+
  | PartyLayer      |   | Bridge           |   <-- Integration paths
  | Provider        |   | (legacy SDK)     |
  | (native path)   |   |                  |
  +-----------------+   +------------------+
           |                    |
           v                    v
  +-----------------+   +------------------+
  | Native CIP-0103 |   | PartyLayerClient |   <-- Underlying wallet
  | Wallet Provider  |   | + Adapters       |       communication
  +-----------------+   +------------------+
```

**Provider interface**: The `CIP0103Provider` TypeScript interface defines exactly four methods: `request()`, `on()`, `emit()`, and `removeListener()`. This is the contract that dApps program against.

**Wallet adapters**: Wallet-specific logic (transport protocols, authentication flows, capability negotiation) is isolated in adapter implementations. The Provider layer never contains wallet-specific branching.

**Network and ledger access**: Network identity uses CAIP-2 format. Ledger API access is proxied through the `ledgerApi` method, which passes requests to the native wallet provider without semantic reinterpretation.

---

## 3. CIP-0103 Method Coverage

CIP-0103 defines 10 mandatory methods. All 10 are implemented across both the native Provider path and the legacy bridge path.

### connect

Establishes a connection between the dApp and the wallet. On the native path, the Provider delegates to the native wallet's `connect` method and handles both synchronous and asynchronous (userUrl) flows. On the bridge path, the call maps to `PartyLayerClient.connect()`. Both paths return a `CIP0103ConnectResult` containing `isConnected` and, for async wallets, a `userUrl`.

### disconnect

Terminates the active connection. The native path delegates to the wallet provider. The bridge path calls `PartyLayerClient.disconnect()`. Both paths emit a `statusChanged` event reflecting the disconnected state.

### isConnected

Returns the current connection status as a `CIP0103ConnectResult`. On the native path, this delegates to the wallet provider. The native Provider also supports this method when no wallet provider is attached, returning `{ isConnected: false }`. On the bridge path, it checks for an active session via `PartyLayerClient.getActiveSession()`.

### status

Returns the full provider status including connection state, provider identity (id, version, type), active network, and session information. On the native path, this is a passthrough to the wallet provider. On the bridge path, the response is synthesized from the active session and provider metadata.

### getActiveNetwork

Returns the active network as a `CIP0103Network` object with a CAIP-2 `networkId` (e.g., `canton:da-mainnet`). The native path delegates to the wallet provider. The bridge path converts the legacy short network name (e.g., `devnet`) to CAIP-2 format using `toCAIP2Network()`, with validation enforced.

### listAccounts

Returns the list of available accounts as `CIP0103Account[]`. The native path delegates to the wallet provider. The bridge path returns a single account derived from the active session's `partyId` and network.

### getPrimaryAccount

Returns the primary account. The native path delegates to the wallet provider. The bridge path returns the session-derived account. Throws `DISCONNECTED` (code 4900) if no session is active.

### signMessage

Signs an arbitrary message. The native path delegates to the wallet provider. The bridge path maps to `PartyLayerClient.signMessage()` and returns the signature string.

### prepareExecute

Prepares and submits a transaction. On the native path, this delegates to the wallet provider, which is responsible for emitting `txChanged` events for the transaction lifecycle. On the bridge path, the call maps to `PartyLayerClient.signTransaction()`, and the bridge emits a `txChanged` event with `pending` status.

### ledgerApi

Proxies HTTP requests to the Canton Ledger API. On the native path, this is a passthrough to the wallet provider, which holds the authentication credentials and endpoint configuration. On the bridge path, this method throws `UNSUPPORTED_METHOD` (code 4200) because the legacy `PartyLayerClient` does not expose ledger API access.

### Forward compatibility

Methods not in the mandatory set are not rejected. On the native path, unknown methods are forwarded to the wallet provider, allowing the Provider to support future CIP extensions without code changes. On the bridge path, unknown methods throw `UNSUPPORTED_METHOD`.

---

## 4. Event Semantics & Lifecycle

CIP-0103 defines four events. PartyLayer implements all four with the following semantics.

### statusChanged

Emitted when the provider's status changes (connection state, network, session). The payload is a `CIP0103StatusEvent` object containing `connection`, `provider`, and optionally `network` and `session` fields.

On the native path, `statusChanged` events from the wallet provider are forwarded to the dApp. The Provider also emits `statusChanged` after orchestrated `connect` and `disconnect` calls by querying the wallet's current status.

On the bridge path, `statusChanged` is emitted when the `PartyLayerClient` fires `session:connected` or `session:disconnected` events, with the payload synthesized from the session data.

### accountsChanged

Emitted when the list of available accounts changes. The payload is a `CIP0103Account[]` array.

On the native path, events are forwarded from the wallet provider. On the bridge path, `accountsChanged` is emitted alongside `statusChanged` when a session connects, containing the single session-derived account.

### txChanged

Emitted during the transaction lifecycle. The payload is a discriminated union (`CIP0103TxChangedEvent`) with the following variants:

| Status | Required fields | Description |
|--------|----------------|-------------|
| `pending` | `commandId` | Transaction submitted, awaiting signing or execution |
| `signed` | `commandId`, `payload.signature`, `payload.signedBy`, `payload.party` | Transaction signed by the wallet |
| `executed` | `commandId`, `payload.updateId`, `payload.completionOffset` | Transaction committed to the ledger |
| `failed` | `commandId` | Transaction failed |

On the native path, `txChanged` events are forwarded from the wallet provider. The wallet is responsible for emitting the complete discriminated union payloads.

On the bridge path, `txChanged` is emitted based on `tx:status` events from `PartyLayerClient`. The bridge maps SDK statuses to CIP-0103 statuses (`pending` and `submitted` to `pending`, `committed` to `executed`, `rejected` and `failed` to `failed`). The `signed` status is not emitted because the legacy SDK does not expose a signed state. The `executed` payload includes best-effort values for `updateId` and `completionOffset` since the legacy client does not provide these fields.

**Deduplication**: The bridge tracks command IDs to prevent duplicate `pending` emissions when both the `prepareExecute` handler and the `tx:status` event wiring would emit for the same transaction.

**Event ordering**: Events are emitted synchronously within the event bus. Listener registration order determines call order. Listener exceptions are caught and swallowed to prevent one handler from breaking others.

### connected

Emitted when an asynchronous connect flow completes. The payload is a `CIP0103ConnectResult`. This event is used by the async wallet handler: the Provider listens for `connected` from the wallet provider after the initial `connect` call returns a `userUrl`, and resolves the dApp-facing Promise when the event arrives.

On the bridge path, this event is not emitted because the bridge does not support asynchronous wallet flows.

---

## 5. Synchronous vs Asynchronous Wallet Support

CIP-0103 accommodates two wallet communication models:

### Synchronous wallets

Browser extensions and local wallets that can respond to `connect` and `prepareExecute` within a single request-response cycle. The `connect` method returns `{ isConnected: true }` immediately.

PartyLayer supports this model on both paths. The native Provider passes through the synchronous response. The bridge always operates synchronously.

### Asynchronous wallets

Mobile wallets, hardware wallets, and other providers that require out-of-band user interaction. The `connect` method returns `{ isConnected: false, userUrl: "..." }`, indicating that the user must visit the URL to approve the connection.

PartyLayer's native Provider handles this transparently:

1. The Provider calls `connect` on the wallet provider.
2. If the response contains `userUrl` and `isConnected` is `false`, the Provider invokes an `onUserUrl` callback (for the dApp to display a QR code or redirect).
3. The Provider subscribes to the `connected` event from the wallet.
4. When the event arrives, the Provider resolves the original Promise with the final `CIP0103ConnectResult`.
5. If the event does not arrive within the timeout period (default 5 minutes), the Provider rejects with a `ProviderRpcError`.

The same pattern applies to `prepareExecute` via the `handleAsyncPrepareExecute` helper, which waits for a terminal `txChanged` event (`executed` or `failed`).

**Consistent dApp-facing API**: The dApp always calls `provider.request({ method: 'connect' })` and receives a Promise. Whether the underlying wallet is synchronous or asynchronous is an implementation detail that the Provider abstracts away.

**Bridge limitation**: The legacy bridge (`client.asProvider()`) does not support asynchronous wallets. It always returns `{ isConnected: true }` from `connect`. dApps requiring async wallet support should use the native `PartyLayerProvider`.

---

## 6. Error Model Alignment

### Standard error codes

All errors on the Provider surface are `ProviderRpcError` instances with numeric `code` fields. PartyLayer uses two code ranges defined by EIP-1193 and EIP-1474:

**EIP-1193 (Provider-level):**

| Code | Semantic |
|------|----------|
| 4001 | User rejected the request |
| 4100 | Not authorized for the requested method or account |
| 4200 | Method not supported by this provider |
| 4900 | Provider is disconnected from all chains |
| 4901 | Provider is disconnected from the requested chain |

**EIP-1474 (JSON-RPC transport):**

| Code | Semantic |
|------|----------|
| -32700 | Parse error (invalid JSON) |
| -32600 | Invalid request object |
| -32601 | Method not found |
| -32602 | Invalid method parameters |
| -32603 | Internal error |
| -32000 | Invalid input |
| -32001 | Resource not found |
| -32002 | Resource unavailable |
| -32003 | Transaction rejected |
| -32004 | Method not supported |
| -32005 | Rate limit exceeded |

### No proprietary codes

PartyLayer's internal error model uses string-based `ErrorCode` values (e.g., `USER_REJECTED`, `WALLET_NOT_FOUND`, `TRANSPORT_ERROR`). These are never exposed on the Provider surface. A bidirectional mapping layer converts between the two models:

- `toProviderRpcError()` converts any error (PartyLayer errors, standard `Error` instances, RPC-shaped objects) into a `ProviderRpcError` with the appropriate numeric code.
- `toPartyLayerError()` reverses the mapping for cases where Provider errors flow back into SDK internals.

This normalization is applied at every exit point in both the native Provider and the bridge. No string-based error code can reach a dApp through the Provider interface.

### Predictability and observability

Standardized error codes enable dApps to implement error handling that works across all wallets without wallet-specific logic. They also enable ecosystem-level observability: monitoring tools and analytics can categorize errors by numeric code regardless of which wallet or Provider implementation generated them.

---

## 7. Wallet-Agnostic Design

PartyLayer's Provider implementation contains no wallet-specific logic.

**Structural verification, not identity checks**: Wallet discovery uses a duck-type check (`isCIP0103Provider`) that verifies the presence of the four required methods (`request`, `on`, `emit`, `removeListener`). It does not check wallet identity, version, or brand.

**Name-based method routing**: The `MethodRouter` dispatches requests based on the method name string. There are no `if (wallet === 'X')` branches. All 10 mandatory methods are registered as passthrough handlers by default, with four (`connect`, `disconnect`, `isConnected`, `prepareExecute`) overridden with orchestrated versions that manage state and events.

**Generic event forwarding**: The native Provider subscribes to all four CIP-0103 events from the wallet provider and forwards them unchanged. No event payload is modified or filtered based on wallet identity.

**Open discovery**: Wallet discovery scans well-known window paths (`window.canton.*` and legacy paths) and uses namespace sub-property enumeration. Any wallet that injects a CIP-0103-compliant object at these paths is discovered automatically. Wallets injecting at non-standard paths can be provided manually via the `DiscoveredProvider` interface.

**Consequence**: A new wallet provider implementing CIP-0103 can integrate with PartyLayer without any changes to PartyLayer's codebase.

---

## 8. Ecosystem Observability

CIP-0103 alignment supports ecosystem-level observability by providing standardized, observable primitives for measuring network usage.

**Method calls as usage signals**: Every dApp-wallet interaction flows through `provider.request({ method, params })`. The 10 mandatory methods provide a well-defined vocabulary of actions (connect, sign, execute, query) that can be observed at the Provider boundary without inspecting payload internals.

**Events as lifecycle signals**: The `txChanged` event provides a standardized transaction lifecycle (`pending` -> `signed` -> `executed` / `failed`) with `commandId` correlation. This enables tracking transaction outcomes without requiring access to ledger internals.

**No custom telemetry in the Provider**: PartyLayer does not inject additional events, hooks, or tracking into the Provider interface. Usage metrics can be derived entirely from the standard CIP-0103 method calls and events. Telemetry logic (if any) lives outside the Provider package, in the SDK layer, and does not affect the Provider's behavior or payload shapes.

**Deterministic provider identity**: The `status` method returns a `provider` object with `id`, `version`, and `providerType` fields, enabling attribution of usage to a specific Provider implementation.

---

## 9. Non-Goals & Explicit Exclusions

PartyLayer's CIP-0103 implementation is intentionally scoped. The following are explicitly outside its responsibilities:

**Ledger semantics**: PartyLayer does not interpret, validate, or modify Daml commands or ledger transactions. The `ledgerApi` method is a transparent proxy. The `prepareExecute` method passes the transaction payload to the wallet provider without inspection.

**Topology and party allocation**: Party IDs, participant nodes, and domain topology are managed by the Canton network and the wallet provider. PartyLayer reports the `partyId` from the wallet session but does not allocate, validate, or manage parties.

**Wallet authorization and custody**: Private key management, transaction signing, and custody decisions are the wallet provider's responsibility. PartyLayer's `signMessage` and `prepareExecute` methods delegate to the wallet. The Provider never handles or stores cryptographic material.

**Authentication and access control**: Session tokens, OAuth flows, and access credentials are managed by the wallet provider or the SDK's adapter layer. The Provider interface does not expose authentication primitives beyond what CIP-0103 defines in the `status` response.

**Network governance**: Network selection, chain configuration, and governance decisions are outside the Provider's scope. The Provider reports the active network in CAIP-2 format but does not manage network switching.

---

## 10. Summary for Reviewers

- **CIP-0103 compliance**: All 10 mandatory Provider methods are implemented verbatim. The Provider interface (`request`, `on`, `emit`, `removeListener`) matches the specification exactly.

- **Two integration paths**: The native `PartyLayerProvider` wraps any CIP-0103 wallet provider directly. The legacy bridge (`createProviderBridge`) wraps `PartyLayerClient` for backward compatibility. Both paths expose the same CIP-0103 interface.

- **Wallet agnosticism**: No wallet-specific logic exists in the Provider. Any CIP-0103-compliant wallet integrates without PartyLayer code changes. Discovery uses structural (duck-type) verification.

- **Error correctness**: All errors are `ProviderRpcError` with standard EIP-1193/EIP-1474 numeric codes. No proprietary error codes reach the Provider surface. Bidirectional error mapping handles all error shapes.

- **Event correctness**: All four CIP-0103 events (`statusChanged`, `accountsChanged`, `txChanged`, `connected`) are implemented with spec-compliant payload shapes. The `txChanged` discriminated union is fully typed with per-status payloads.

- **Ecosystem readiness**: Standardized method calls and events provide the observable primitives for ecosystem-level usage measurement. No custom telemetry is injected into the Provider interface.
