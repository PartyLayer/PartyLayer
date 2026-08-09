# @partylayer/adapter-console

> **Legacy integration.** This package predates the generic bridge and is kept for
> compatibility; a new wallet should not copy this pattern. New wallets integrate
> through Path A or Path B with no PartyLayer-specific code, see
> <https://partylayer.xyz/docs/generic-bridge>.

<div align="center">

**Console Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-console.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-console)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for the [Console Wallet](https://www.digitalasset.com/) browser extension. Uses the official `@console-wallet/dapp-sdk` which communicates via `window.postMessage`.

> **Note**: This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if building a custom setup.

---

## Installation

```bash
npm install @partylayer/adapter-console
```

---

## Usage with SDK

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
await client.connect({ walletId: 'console' });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Console Wallet Docs](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
