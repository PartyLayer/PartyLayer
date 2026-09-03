# Production Security Guide

This guide covers security requirements and best practices for deploying dApps that use PartyLayer SDK in production.

## Table of Contents

- [HTTPS Requirements](#https-requirements)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Platform-Specific Configuration](#platform-specific-configuration)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Security Best Practices](#security-best-practices)

---

## HTTPS Requirements

**HTTPS is mandatory for production deployments.**

### Why HTTPS?

1. **Web Crypto API** - Session encryption (AES-GCM) requires a secure context
2. **Origin Security** - Session origin binding depends on secure origins
3. **Wallet Security** - Wallets may reject connections from insecure origins
4. **Browser Requirements** - Modern browsers restrict sensitive APIs on HTTP

### Platform HTTPS Support

| Platform | HTTPS | Configuration |
|----------|-------|---------------|
| Vercel | Automatic | No config needed |
| Netlify | Automatic | No config needed |
| Cloudflare Pages | Automatic | No config needed |
| GitHub Pages | Automatic | Use `https://` URL |
| AWS S3 + CloudFront | Manual | Configure SSL certificate |
| Self-hosted | Manual | Use Let's Encrypt or commercial SSL |

---

## Content Security Policy (CSP)

CSP headers protect your dApp from XSS attacks and control resource loading.

### Recommended CSP for PartyLayer

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net;
  connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com;
  frame-src 'self' https://*.cantonloop.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
```

### CSP Directives Explained

| Directive | Purpose | Required For |
|-----------|---------|--------------|
| `script-src https://cdn.jsdelivr.net` | Loop SDK lazy-loading | Loop Wallet |
| `connect-src https://registry.partylayer.xyz` | Registry fetch | All wallets |
| `connect-src https://*.cantonloop.com` | Loop API | Loop Wallet |
| `frame-src https://*.cantonloop.com` | Loop popup/iframe | Loop Wallet |
| `style-src 'unsafe-inline'` | WalletModal styling | React components |

### Additional Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Platform-Specific Configuration

### Vercel

Create `vercel.json` in your project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com; frame-src 'self' https://*.cantonloop.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### Netlify

Create `netlify.toml` in your project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com; frame-src 'self' https://*.cantonloop.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "SAMEORIGIN"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### Cloudflare Pages

Create `_headers` file in your `public` folder:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com; frame-src 'self' https://*.cantonloop.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
```

### Next.js

Add to `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com; frame-src 'self' https://*.cantonloop.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Vite (Static Hosting)

For Vite apps deployed to static hosting, use the platform-specific configuration above. For development, you can add headers via `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net; connect-src 'self' https://registry.partylayer.xyz https://*.cantonloop.com wss://*.cantonloop.com; frame-src 'self' https://*.cantonloop.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
    },
  },
});
```

> **Note:** `'unsafe-eval'` is only needed for development with Vite's HMR. Remove it in production.

---

## Pre-Deployment Checklist

Run through this checklist before deploying to production:

### Infrastructure

- [ ] HTTPS enabled (automatic on most platforms)
- [ ] Custom domain configured with SSL
- [ ] CSP headers configured
- [ ] Security headers (X-Frame-Options, etc.) configured

### SDK Configuration

- [ ] Using `mainnet` network
- [ ] Using `stable` channel
- [ ] App name configured correctly
- [ ] Production origin set (if explicitly configured)

```typescript
const client = createPartyLayer({
  network: 'mainnet',      // ✓ Production network
  channel: 'stable',       // ✓ Stable registry
  app: { 
    name: 'My Production App',
    // origin is auto-detected from window.location.origin
  },
});
```

### Error Handling

- [ ] Error events handled (`client.on('error', ...)`)
- [ ] User-friendly error messages displayed
- [ ] React Error Boundary implemented
- [ ] Fallback UI for connection failures

### Testing

- [ ] Tested with Console Wallet (if targeting browser extension users)
- [ ] Tested with Loop Wallet (if targeting mobile/QR users)
- [ ] Tested session persistence (page refresh)
- [ ] Tested disconnect flow
- [ ] Tested error scenarios (wallet not installed, user rejected, timeout)

---

## Security Best Practices

### 1. Never Store Sensitive Data

The SDK encrypts session data, but you should never store:
- Private keys
- Seed phrases
- Unencrypted credentials

```typescript
// ❌ Don't do this
localStorage.setItem('privateKey', userPrivateKey);

// ✅ SDK handles session storage securely
const session = await client.connect({ walletId: 'console' });
// Session is automatically encrypted and stored
```

### 2. Validate Wallet Responses

Always validate data received from wallets:

```typescript
const session = await client.connect({ walletId: 'console' });

// ✅ Validate session data
if (!session.partyId || !session.sessionId) {
  throw new Error('Invalid session response');
}
```

### 3. Handle Errors Gracefully

```typescript
import { 
  WalletNotInstalledError,
  UserRejectedError,
  TimeoutError 
} from '@partylayer/sdk';

try {
  await client.connect({ walletId: 'console' });
} catch (error) {
  if (error instanceof WalletNotInstalledError) {
    showMessage('Please install Console Wallet extension');
  } else if (error instanceof UserRejectedError) {
    showMessage('Connection was cancelled');
  } else if (error instanceof TimeoutError) {
    showMessage('Connection timed out. Please try again.');
  } else {
    showMessage('An unexpected error occurred');
    console.error(error);
  }
}
```

### 4. Use Event Listeners

Monitor SDK events for security-relevant changes:

```typescript
client.on('session:disconnected', () => {
  // Clear any cached user data
  clearUserState();
  redirectToLogin();
});

client.on('session:expired', () => {
  // Session expired, prompt re-authentication
  showReconnectPrompt();
});

client.on('error', (event) => {
  // Log errors for monitoring (without sensitive data)
  logError({
    code: event.error.code,
    message: event.error.message,
    timestamp: Date.now(),
  });
});
```

### 5. Implement React Error Boundaries

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

class WalletErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Wallet error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Usage
<WalletErrorBoundary fallback={<WalletErrorFallback />}>
  <PartyLayerProvider client={client}>
    <App />
  </PartyLayerProvider>
</WalletErrorBoundary>
```

---

## Registry Security

The SDK includes built-in registry security:

| Feature | Description |
|---------|-------------|
| **Schema Validation** | Every entry checked against the registry schema on each build |
| **CIP-0103 Flag Gate** | Blocks removal of a wallet's `cip0103.native` marker |
| **Public History** | Published from a public repository; every change is in commit history |
| **Ed25519 Signatures** | Implemented in the client, NOT enabled in production (see `SIGNING.md`) |
| **Sequence Numbers** | Prevents downgrade attacks |
| **Schema Validation** | Validates registry structure |
| **Last-Known-Good Cache** | Falls back to verified cache on failure |

These features work automatically - no configuration needed.

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** disclose publicly
2. Email: security@partylayer.xyz
3. Include: Description, steps to reproduce, potential impact

We follow responsible disclosure and will credit reporters (with permission).

---

## Summary

| Requirement | Priority | Status |
|-------------|----------|--------|
| HTTPS | Critical | Platform-dependent |
| CSP Headers | High | Configure per platform |
| Error Handling | High | Implement in your app |
| Security Headers | Medium | Configure per platform |
| Event Monitoring | Medium | Implement in your app |

Following this guide ensures your dApp is secure and production-ready.
