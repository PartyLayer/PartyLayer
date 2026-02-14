# @partylayer/provider

<div align="center">

**CIP-0103 native Provider implementation for Canton Network**

[![npm version](https://img.shields.io/npm/v/@partylayer/provider.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/provider)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

`@partylayer/provider` implements the [CIP-0103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md) Provider interface for the Canton Network. It provides a standardized way for dApps to communicate with any CIP-0103-compliant wallet.

### Features

- **CIP-0103 Compliant**: All 10 mandatory methods implemented (`connect`, `disconnect`, `isConnected`, `status`, `getActiveNetwork`, `listAccounts`, `getPrimaryAccount`, `signMessage`, `prepareExecute`, `ledgerApi`)
- **Wallet Discovery**: Automatic scanning for injected CIP-0103 providers at `window.canton.*`
- **Async Wallet Support**: Handles both synchronous (browser extension) and asynchronous (mobile/QR) wallet flows
- **Standard Error Model**: `ProviderRpcError` with EIP-1193 / EIP-1474 numeric codes
- **CAIP-2 Networks**: Network identity using Chain Agnostic standard format
- **Legacy Bridge**: `createProviderBridge()` maps `PartyLayerClient` to CIP-0103 Provider interface

---

## Installation

```bash
npm install @partylayer/provider
```

---

## Quick Start

### Native Provider (with CIP-0103 wallets)

```typescript
import { PartyLayerProvider, discoverProviders } from '@partylayer/provider';

// Discover injected CIP-0103 wallet providers
const wallets = discoverProviders();

// Create provider with first discovered wallet
const provider = new PartyLayerProvider({ walletProvider: wallets[0] });

// Connect
const result = await provider.request({ method: 'connect' });

// Get primary account
const account = await provider.request({ method: 'getPrimaryAccount' });
```

### Legacy Bridge (with PartyLayerClient)

```typescript
import { createProviderBridge } from '@partylayer/provider';
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet' });
const provider = createProviderBridge(client);

// Use standard CIP-0103 interface
await provider.request({ method: 'connect', params: { walletId: 'console' } });
```

---

## CIP-0103 Events

```typescript
provider.on('statusChanged', (status) => { /* connection state changed */ });
provider.on('accountsChanged', (accounts) => { /* accounts updated */ });
provider.on('txChanged', (tx) => { /* transaction lifecycle update */ });
provider.on('connected', (result) => { /* async connect completed */ });
```

---

## Links

- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [CIP-0103 Specification](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
