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
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
await client.connect({ walletId: 'bron' });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Bron Developer Portal](https://developer.bron.org/)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
