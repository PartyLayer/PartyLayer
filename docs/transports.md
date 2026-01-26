# Transport Layer Guide

**Deep link, popup, and postMessage transports for wallet communication**

## Overview

CantonConnect provides transport abstractions for different wallet communication patterns:
- **DeepLinkTransport** - Mobile wallet deep links
- **PopupTransport** - Popup window flows
- **PostMessageTransport** - Iframe/parent communication
- **MockTransport** - Testing and development

## Deep Link Transport

### Use Case

Mobile wallets that use deep link URLs (e.g., `mywallet://connect`).

### Sequence Diagram

```
dApp                    Wallet App
  |                         |
  |-- openConnectRequest -->|
  |   (deep link URL)       |
  |                         |
  |                         | [User approves]
  |                         |
  |<-- postMessage/redirect--|
  |   (callback with state) |
  |                         |
```

### Code Example

```typescript
import { DeepLinkTransport } from '@cantonconnect/core';

const transport = new DeepLinkTransport();

const request: ConnectRequest = {
  appName: 'My dApp',
  origin: 'https://myapp.com',
  network: 'devnet',
  state: 'random-nonce-123',
  redirectUri: 'https://myapp.com/callback',
};

const options: TransportOptions = {
  origin: 'https://myapp.com',
  allowedOrigins: ['https://myapp.com'],
  timeoutMs: 60000,
};

const response = await transport.openConnectRequest(
  'mywallet://connect',
  request,
  options
);
```

### Security

- ✅ State parameter (nonce) for CSRF protection
- ✅ Origin validation
- ✅ Timeout enforcement
- ✅ Callback origin allowlist

### Testing

Use `MockTransport` for deterministic testing:

```typescript
import { MockTransport } from '@cantonconnect/core';

const mockTransport = new MockTransport();
mockTransport.setMockResponse('test-state', {
  state: 'test-state',
  partyId: toPartyId('party::test'),
});
```

## Popup Transport

### Use Case

Web wallets that use popup windows for user interaction.

### Sequence Diagram

```
dApp                    Popup Window          Wallet Server
  |                         |                      |
  |-- openPopup() --------->|                      |
  |                         |-- GET /auth -------->|
  |                         |                      |
  |                         |<-- redirect ---------|
  |                         |   (callback URL)      |
  |                         |                      |
  |<-- postMessage ---------|                      |
  |   (callback data)       |                      |
  |                         |                      |
```

### Code Example

```typescript
import { PopupTransport } from '@cantonconnect/core';

const transport = new PopupTransport();

const response = await transport.openConnectRequest(
  'https://wallet.example.com/connect',
  request,
  options
);
```

### Security

- ✅ Popup window management (centered, explicit size)
- ✅ PostMessage origin validation
- ✅ State parameter validation
- ✅ Popup closed detection

## PostMessage Transport

### Use Case

Communication with iframes or parent windows.

### Code Example

```typescript
import { PostMessageTransport } from '@cantonconnect/core';

const transport = new PostMessageTransport('https://wallet.example.com');
transport.setTargetWindow(iframe.contentWindow);

await transport.connect();
const response = await transport.openConnectRequest(
  'https://wallet.example.com',
  request,
  options
);
```

## Mock Transport

### Use Case

Testing and development without real wallet connections.

### Code Example

```typescript
import { MockTransport } from '@cantonconnect/core';

const transport = new MockTransport();

// Set mock response
transport.setMockResponse('test-state', {
  state: 'test-state',
  partyId: toPartyId('party::mock'),
  sessionToken: 'mock-token',
});

// Use in adapter
const response = await transport.openConnectRequest(
  'mock://connect',
  request,
  options
);
```

### Deterministic Behavior

MockTransport generates consistent responses for the same state:

```typescript
// Same state = same response
const response1 = await transport.openConnectRequest(...);
const response2 = await transport.openConnectRequest(...);
expect(response1.partyId).toBe(response2.partyId);
```

## Async Approval Flows

Some wallets use async approval (job ID polling):

```typescript
const response = await transport.openSignRequest(...);

if (response.jobId) {
  // Poll for status
  const status = await transport.pollJobStatus!(
    response.jobId,
    'https://wallet.example.com/status',
    options
  );
  
  if (status.status === 'approved') {
    // Use status.result.signature
  }
}
```

## Error Handling

All transports throw `TransportError` on failure:

```typescript
try {
  await transport.openConnectRequest(...);
} catch (err) {
  if (err instanceof TransportError) {
    // Handle transport error
  }
}
```

## Testing Guidance

### Unit Tests

Test transport behavior in isolation:

```typescript
describe('DeepLinkTransport', () => {
  it('should validate state parameter', async () => {
    // Test state validation
  });
  
  it('should validate origin', async () => {
    // Test origin validation
  });
  
  it('should timeout after specified duration', async () => {
    // Test timeout behavior
  });
});
```

### Integration Tests

Use MockTransport for adapter integration tests:

```typescript
const adapter = new MyWalletAdapter({
  useMockTransport: true,
});
```

### E2E Tests

Use MockTransport in demo app for E2E tests:

```typescript
// In demo app
const adapter = new Cantor8Adapter({
  useMockTransport: process.env.NEXT_PUBLIC_MOCK_WALLETS === '1',
});
```

## Best Practices

1. **Always use state parameter** - Prevents CSRF attacks
2. **Validate origins** - Only accept callbacks from allowed origins
3. **Set timeouts** - Prevent hanging requests
4. **Handle errors gracefully** - Map to CantonConnect errors
5. **Test with mocks** - Use MockTransport for deterministic tests

## References

- Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
- Security Checklist: `docs/security-checklist.md`
