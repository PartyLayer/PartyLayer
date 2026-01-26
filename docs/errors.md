# Error Codes Reference

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

All errors extend `CantonConnectError` and have a stable `code` property for programmatic handling and UI messages.

## Error Codes

| Code | Class | Description | UX Message |
|------|-------|-------------|------------|
| `WALLET_NOT_FOUND` | `WalletNotFoundError` | Wallet not in registry | "Wallet not found. Please check the wallet ID." |
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
| `TIMEOUT` | `TimeoutError` | Operation timed out | "Operation timed out. Please try again." |

## Error Handling

```typescript
import {
  WalletNotFoundError,
  UserRejectedError,
  CapabilityNotSupportedError,
} from '@cantonconnect/sdk';

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
