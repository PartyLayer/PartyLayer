# @partylayer/adapter-nightly

<div align="center">

**Nightly Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-nightly.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-nightly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for the [Nightly Wallet](https://nightly.app/), a multichain wallet with Canton Network support. The wallet injects at `window.nightly.canton` and uses a callback-based signing interface.

> **Note**: This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if building a custom setup.

---

## Installation

```bash
npm install @partylayer/adapter-nightly
```

---

## Usage with SDK

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
await client.connect({ walletId: 'nightly' });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Nightly Wallet](https://nightly.app/)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
