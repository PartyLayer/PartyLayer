# @partylayer/adapter-bron

> **Default application integration:** The React kit already includes this compatibility
> runtime where applicable. Install `@partylayer/react @tanstack/react-query` in one
> command and use `PartyLayerKit` with `ConnectButton`; no per-wallet package
> installation is required. See [the quick start](https://partylayer.xyz/docs/quick-start).
> The instructions below are for explicitly using this standalone compatibility package.
> Native provider paths and limits are recorded in the [integration matrix](https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-cip0103-matrix.md).

> **Legacy integration.** This package predates the generic bridge and is kept for
> compatibility; a new wallet should not copy this pattern. New wallets integrate
> through Path A or Path B with no PartyLayer-specific code, see
> <https://partylayer.xyz/docs/generic-bridge>.

<div align="center">

**Bron Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-bron.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-bron)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for the [Bron Wallet](https://www.canton.network/ecosystem/bron-wallet), an enterprise remote signer using OAuth2 authentication and API-based signing.

> **Note**: This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if building a custom setup.

---

## Installation

```bash
npm install @partylayer/adapter-bron
```

---

## Usage with SDK

```typescript
import { createPartyLayer, type BronAdapterConfig } from '@partylayer/sdk';

// Supply the OAuth endpoints, public client ID, registered redirect URI and
// signer API URL issued for your application by Bron.
export function createBronClient(bron: BronAdapterConfig) {
  return createPartyLayer({
    network: 'devnet',
    app: { name: 'My Canton dApp' },
    bron,
  });
}
```

Bron requires application-owned OAuth and signer API configuration. Without
`bron` configuration, Bron is omitted from the wallet picker. After constructing
the client with your approved configuration, find Bron in `await client.listWallets()`
and pass that entry's `walletId` to `client.connect()` from a user action in the browser.

Use PKCE for browser flows and never expose a client secret in frontend code.
Register the callback URL with Bron and follow their onboarding instructions;
this package does not provision a Bron account or credentials.

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Bron Developer Portal](https://developer.bron.org/)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
