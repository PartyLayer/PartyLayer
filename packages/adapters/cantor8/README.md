# @partylayer/adapter-cantor8

<div align="center">

**Cantor8 Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-cantor8.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-cantor8)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for the [Cantor8 (C8) Wallet](https://cantor8.tech/about), using deep link transport with QR code support for mobile wallet connections.

> **Note**: This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if building a custom setup.

---

## Installation

```bash
npm install @partylayer/adapter-cantor8
```

---

## Usage with SDK

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
await client.connect({ walletId: 'cantor8' });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Cantor8](https://cantor8.tech/about)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
