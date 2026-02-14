# @partylayer/adapter-bron

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
