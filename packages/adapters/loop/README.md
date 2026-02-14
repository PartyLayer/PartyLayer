# @partylayer/adapter-loop

<div align="center">

**5N Loop Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-loop.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-loop)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for the [5N Loop Wallet](https://github.com/fivenorth-io/loop-sdk). Uses the official `@fivenorth/loop-sdk` package which communicates via QR code / popup flow over WebSocket.

> **Note**: This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if building a custom setup.

---

## Installation

```bash
npm install @partylayer/adapter-loop
```

---

## Usage with SDK

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
await client.connect({ walletId: 'loop' });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Loop SDK](https://github.com/fivenorth-io/loop-sdk)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
