# Error Codes Reference

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

All errors extend `PartyLayerError` and have a stable `code` property for programmatic handling and UI messages.

## Error Codes

| Code | Class | Description | UX Message |
|------|-------|-------------|------------|
| `WALLET_NOT_FOUND` | `WalletNotFoundError` | No wallet with this id is known (not in registry, no adapter registered) | "Wallet not found. Please check the wallet ID." |
| `ADAPTER_NOT_REGISTERED` | `AdapterNotRegisteredError` | A popup/remote (discovery-adapter) wallet was selected but the app registered no matching provider adapter | "This wallet needs additional setup by the app." |
| `WALLET_NOT_INSTALLED` | `WalletNotInstalledError` | Wallet extension/SDK not installed | "Please install [Wallet Name] to continue." |
| `USER_REJECTED` | `UserRejectedError` | User rejected the operation | "Operation cancelled by user." |
| `ORIGIN_NOT_ALLOWED` | `OriginNotAllowedError` | Origin not in allowlist | "This origin is not allowed to connect." |
| `SESSION_EXPIRED` | `SessionExpiredError` | Session has expired | "Session expired. Please reconnect." |
| `CAPABILITY_NOT_SUPPORTED` | `CapabilityNotSupportedError` | Wallet doesn't support capability | "This wallet doesn't support [capability]." |
| `TRANSPORT_ERROR` | `TransportError` | Communication error with wallet | "Failed to communicate with wallet. Please try again." |
| `REGISTRY_FETCH_FAILED` | `RegistryFetchFailedError` | Failed to fetch registry | "Failed to load wallet registry. Using cached version." |
| `REGISTRY_VERIFICATION_FAILED` | `RegistryVerificationFailedError` | Registry signature invalid | "Registry verification failed. Using cached version." |
| `REGISTRY_SCHEMA_INVALID` | `RegistrySchemaInvalidError` | Registry schema invalid | "Invalid registry format. Using cached version." |
| `INTERNAL_ERROR` | `InternalError` | Internal SDK error | "An unexpected error occurred. Please try again." |
| `NETWORK_MISMATCH` | `NetworkMismatchError` | Wallet is on a different network than the dApp requires | "Your wallet is on the wrong network. Switch it, then reconnect." |
| `TIMEOUT` | `TimeoutError` | Operation timed out | "Operation timed out. Please try again." |
| `INSUFFICIENT_TRAFFIC` | `InsufficientTrafficError` | Submission rejected because the member's traffic allowance (base rate plus purchased extra) is exhausted | "Not enough traffic to submit. Top up traffic, then try again." |
| `SYNCHRONIZER_ERROR` | `SynchronizerError` | A synchronizer level condition the kit surfaces directly, for example a submission whose disclosed contracts span more than one synchronizer, or a synchronizer the app routes to being unavailable. Kit level and additive, with no CIP-0103 wire mapping | "A synchronizer is unavailable. Please retry, or switch synchronizer if your app supports it." |

## Synchronizer failures: a kit level code, dApp observed routing stays yours

The kit provides one additive, kit level code for the synchronizer conditions it
surfaces itself: `SYNCHRONIZER_ERROR` (`SynchronizerError`). It has no CIP-0103 wire
mapping, because CIP-0103 defines no dedicated synchronizer code, so it never modifies
CIP-0103 semantics. Use it to classify a synchronizer level failure the kit raises, for
example a combined disclosure set that spans more than one synchronizer.

Canton routing failures observed through the dApp's own ledger and registry calls do
NOT get this code, on purpose. Failures such as `NO_COMMON_DOMAIN`,
`NOT_CONNECTED_TO_ALL_CONTRACT_DOMAINS`, and `UNKNOWN_CONTRACT_DOMAINS`, and the token
standard registry's `409` for a contract that is mid reassignment, surface inside the
dApp's own ledger and registry calls. That is because the CIP-0056 token standard hooks
are Model 2: the dApp performs its own reads and submissions with its own fetchers, so
it observes these failures directly and maps them itself.

For the one case the kit can help with ahead of time, use `assertSingleSynchronizer`
from `@partylayer/react/query` as a preventive check on a combined disclosure set before
building a submission. It deliberately throws a plain `Error`, not a `PartyLayerError`,
because that module is framework free and imports nothing.

## Error Handling

```typescript
import {
  WalletNotFoundError,
  UserRejectedError,
  CapabilityNotSupportedError,
} from '@partylayer/sdk';

try {
  await client.connect();
} catch (error) {
  if (error instanceof WalletNotFoundError) {
    // Show wallet not found message
  } else if (error instanceof UserRejectedError) {
    // User cancelled - don't show error, just return
    return;
  } else if (error instanceof CapabilityNotSupportedError) {
    // Show capability not supported message
  } else {
    // Generic error handling
    console.error('Error:', error.code, error.message);
  }
}
```

## Error Properties

All errors have:
- `code`: Stable error code (string literal)
- `message`: Human-readable message
- `details`: Additional context (walletId, phase, etc.)
- `isOperational`: Whether error is user-actionable
- `toJSON()`: Serialize for telemetry/logging
