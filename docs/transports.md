# Transport Layer Guide

**Deep link, popup, and postMessage transports for wallet communication**

## Overview

PartyLayer provides transport abstractions for different wallet communication patterns:
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
import { DeepLinkTransport } from '@partylayer/core';

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
import { MockTransport } from '@partylayer/core';

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
import { PopupTransport } from '@partylayer/core';

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

### Session Restore (token-less)

Popup/remote wallets surfaced through the **`discovery-adapter`** transport (e.g.
Walley) typically **do not provide a reusable session token or public key**, and
they don't need to. PartyLayer restores their session by **polling the wallet**
(`status` / `listAccounts`) and persisting on a fresh connect, not by replaying a
stored credential. Their adapter capabilities never include `events`.

**Don't add your own "no token / no public key" check** in app code, a popup/remote
wallet legitimately lacks one, and rejecting the connection on that basis breaks an
otherwise-valid session. Let PartyLayer's poll-based restore handle it.

## PostMessage Transport

### Use Case

Communication with iframes or parent windows.

### Code Example

```typescript
import { PostMessageTransport } from '@partylayer/core';

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
import { MockTransport } from '@partylayer/core';

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

> **`useMockTransport` no longer exists.** This section used to tell you to pass
> `useMockTransport` to an adapter's constructor. That option was removed from the
> shipped adapters in `703a645` (the Cantor8 rebuild on its real SDK) — see
> `packages/adapters/cantor8/CHANGELOG.md`. Passing it today does nothing, and on a
> typed config it is a compile error. The instruction stood here after the option
> was gone; this is the correction.

`MockTransport` itself is still exported from `@partylayer/core` and is still the
right tool for a **transport-level** test — one that drives `openConnectRequest`,
`openSignRequest`, or `pollJobStatus` directly:

```typescript
import { MockTransport } from '@partylayer/core';

const transport = new MockTransport();
transport.setMockResponse('connected', { /* ConnectResponse */ });
// Drive the transport directly; there is no adapter config flag for this.
```

### E2E Tests

Do **not** reach for a mock flag or an environment switch. The demo's end-to-end
mocking works at the provider boundary instead: `apps/demo/public/mock-cip0103-wallet.js`
assigns a real CIP-0103 provider to `window.canton.demoWallet` from a synchronous
script tag, before hydration, the way an extension content script would. The demo
registers `CantonDemoWalletAdapter` over it, and the e2e helper
`connectToMockWallet()` drives it.

That fixture is gated on `process.env.NODE_ENV !== 'production'`, so it never
reaches a production bundle.

Prefer this shape for anything new. A fixture at the transport boundary exercises
discovery, announce, the adapter contract, connect and restore through the same
path a real wallet takes. A configuration flag threaded through an adapter
constructor bypasses that boundary and tests less, which is why the flag was
removed rather than repaired.

### Known gap: no end-to-end coverage of popup or relay transports

**What is covered.** The injected/announce family. The demo's provider fixture
sits at `window.canton`, so every test that connects — session persistence,
sign-and-bridge, the full connect flow — drives discovery, the adapter contract,
connect and restore through the real code path.

**What is not.** Popup and relay. Nothing exercises `openConnectRequest`,
`openSignRequest` or `pollJobStatus` end-to-end. Concretely, the wallets that
connect by opening a popup (Cauri, OneSwap, Walley) are asserted only as far as
the picker — that they are offered — and never through a connect. WalletConnect's
spec self-skips when no relay is reachable, which in practice is always in CI.

This is a real gap, not an oversight to be argued away. It is written down here
because the alternative is that it stays invisible: the suite reports green, and
green over an untested transport family reads the same as green over a tested one.

**The shape a fix must take.** A fixture at the transport boundary — a stub popup
window or relay endpoint that the real transport talks to — using the
`MockTransport` building block already exported from `@partylayer/core`.

**The shape it must not take.** A constructor flag or an environment switch that
selects a mock at runtime. We had one (`useMockTransport`), it was removed in
`703a645`, and it should not come back. An env-keyed mock branch is reachable from
a production bundle, so it trades a real risk in shipped code for convenience in
tests. That trade is wrong even when the switch would buy coverage we want, and
the coverage argument is exactly the one that will be made for it next time.

**Playwright: use `domcontentloaded`, not `networkidle`.** The PartyLayer client
keeps background connections open (provider channels, registry/SWR), so a page
**never reaches `networkidle`** and `page.goto(url, { waitUntil: 'networkidle' })`
hangs or captures an empty render. Wait on `'domcontentloaded'` (plus an explicit
`waitForSelector` / `waitFor` for the element you assert):

```typescript
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Connect Wallet/i }).waitFor();
```

## Best Practices

1. **Always use state parameter** - Prevents CSRF attacks
2. **Validate origins** - Only accept callbacks from allowed origins
3. **Set timeouts** - Prevent hanging requests
4. **Handle errors gracefully** - Map to PartyLayer errors
5. **Test with mocks** - Use MockTransport for deterministic tests

## References

- Wallet Integration Guide: https://docs.digitalasset.com/integrate/devnet/index.html
- Security Checklist: `docs/security-checklist.md`
