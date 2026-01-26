# Security Checklist for Wallet Providers

**Security requirements for CantonConnect wallet adapters**

## State Parameter (Nonce)

✅ **Required**: Use a cryptographically random state parameter for CSRF protection

```typescript
private generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
```

✅ **Validate state** in all callbacks:
```typescript
if (callback.state !== request.state) {
  throw new Error('State mismatch');
}
```

## Redirect URI Validation

✅ **Validate redirect URIs** match expected values:
```typescript
const expectedRedirectUri = `${ctx.origin}/callback`;
if (callback.redirectUri !== expectedRedirectUri) {
  throw new Error('Invalid redirect URI');
}
```

✅ **Use allowlist** for redirect URIs (if supported):
```typescript
const allowedRedirectUris = [
  'https://myapp.com/callback',
  'https://app.myapp.com/callback',
];
if (!allowedRedirectUris.includes(callback.redirectUri)) {
  throw new Error('Redirect URI not allowed');
}
```

## Origin Validation

✅ **Validate callback origins**:
```typescript
const allowedOrigins = [ctx.origin];
if (!allowedOrigins.includes(event.origin)) {
  return; // Ignore message from disallowed origin
}
```

✅ **Use origin allowlist** in registry entry:
```json
{
  "originAllowlist": [
    "https://myapp.com",
    "https://*.myapp.com"
  ]
}
```

SDK automatically enforces registry origin allowlist.

## Signing Payload Display

✅ **Display signing payloads** in user-friendly format:
- Show transaction summary (not raw bytes)
- Display party IDs clearly
- Show network context
- Include transaction type/command name

✅ **Never expose**:
- Private keys
- Internal wallet state
- Sensitive user data

## Token Storage

✅ **OAuth tokens**:
- Store in memory by default (most secure)
- If persistence needed, use encrypted storage
- Never store in localStorage in plain text
- Clear tokens on logout

✅ **Session tokens**:
- Only store session metadata (not private keys)
- Encrypt session data before storage
- Include expiration timestamps
- Clear expired sessions

## Timeout Enforcement

✅ **Set timeouts** for all async operations:
```typescript
const timeoutMs = opts?.timeoutMs || 60000;
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Timeout')), timeoutMs);
});
await Promise.race([operationPromise, timeoutPromise]);
```

## Error Handling

✅ **Never expose sensitive errors**:
```typescript
try {
  // Wallet operation
} catch (err) {
  // Map to user-friendly error
  throw mapUnknownErrorToCantonConnectError(err, {
    walletId: this.walletId,
    phase: 'connect',
  });
}
```

✅ **Error codes**:
- Use stable error codes (USER_REJECTED, TIMEOUT, etc.)
- Don't expose internal error details
- Provide actionable error messages

## Replay Protection

✅ **Use nonces** for signing requests:
```typescript
const nonce = generateNonce();
const signature = await wallet.signMessage(message, { nonce });
```

✅ **Validate nonces** on server side (if applicable)

## Audit Logging

✅ **Log security events**:
- Connection attempts
- Signing requests
- Origin validation failures
- State mismatches

✅ **Don't log**:
- Private keys
- Full transaction data
- User identifiers (use hashed IDs)

## OAuth Security (Enterprise Wallets)

✅ **Use PKCE** for Authorization Code flow:
```typescript
const { verifier, challenge } = await generatePKCE();
// Include challenge in authorization request
// Include verifier in token exchange
```

✅ **Validate token responses**:
- Check token expiration
- Validate token scope
- Verify token signature (if JWT)

✅ **Token refresh**:
- Use refresh tokens securely
- Rotate refresh tokens
- Handle token expiration gracefully

## Deep Link Security

✅ **Validate deep link URLs**:
- Check URL scheme matches expected
- Validate query parameters
- Verify callback origin

✅ **Handle deep link callbacks**:
- Validate state parameter
- Check callback origin
- Verify signature (if provided)

## Popup Security

✅ **Popup window management**:
- Set explicit window size
- Center popup on screen
- Close popup after callback
- Handle popup blocking gracefully

✅ **PostMessage security**:
- Validate message origin
- Check message type
- Verify state parameter

## Registry Security

✅ **Verify registry signatures**:
- Always verify Ed25519 signatures
- Check sequence numbers (prevent downgrades)
- Use last-known-good cache on failure

✅ **Key management**:
- Rotate keys periodically
- Support multiple public keys during rotation
- Never commit private keys to repository

## Testing

✅ **Security testing**:
- Test state validation
- Test origin validation
- Test timeout behavior
- Test error handling
- Test token storage

✅ **Conformance tests**:
- Run conformance tests before registry submission
- Verify all security checks pass
- Review test report for security issues

## Compliance

✅ **Follow security best practices**:
- OWASP guidelines
- Web Crypto API standards
- OAuth 2.0 security best practices

✅ **Security audits**:
- Conduct security review before stable release
- Document security assumptions
- Maintain security changelog

## Reporting Security Issues

Report security vulnerabilities to: security@cantonconnect.io

Do not disclose vulnerabilities publicly until patched.
