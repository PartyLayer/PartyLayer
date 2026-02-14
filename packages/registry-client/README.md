# @partylayer/registry-client

<div align="center">

**Wallet registry client for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/registry-client.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/registry-client)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

`@partylayer/registry-client` fetches and validates the Canton Network wallet registry. It provides wallet metadata (names, icons, install URLs) with integrity verification and caching.

### Features

- **Signed Registry**: Verifies registry signature to prevent tampering
- **Automatic Caching**: Reduces network requests with configurable TTL
- **Schema Validation**: Ensures registry entries match expected format
- **Stale Fallback**: Uses cached data when network is unavailable

---

## Installation

```bash
npm install @partylayer/registry-client
```

> **Note**: Most dApp developers should use `@partylayer/sdk` instead, which includes the registry client automatically.

---

## Usage

```typescript
import { RegistryClient } from '@partylayer/registry-client';

const registry = new RegistryClient({
  url: 'https://registry.partylayer.xyz/v1/wallets.json',
});

const wallets = await registry.getWallets();
// [{ id: 'console', name: 'Console Wallet', icon: '...', ... }, ...]
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
