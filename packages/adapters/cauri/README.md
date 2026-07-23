# @partylayer/adapter-cauri

<div align="center">

**Cauri Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-cauri.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-cauri)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for [Cauri Wallet](https://cauri.cc), a non-custodial passkey-based Canton wallet. Cauri is a remote wallet: it exposes a CIP-103 JSON-RPC + SSE gateway, and every wallet-changing action opens a popup where the user authenticates with their passkey.

> **Note**: This adapter is not included in `@partylayer/sdk` by default because it requires runtime configuration (`apiBase`, `walletUiBase`). Install and register manually.

---

## Installation

```bash
npm install @partylayer/adapter-cauri
```

---

## Usage

```typescript
import { createPartyLayer, getBuiltinAdapters, CauriRemoteAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  adapters: [
    ...getBuiltinAdapters(),
    new CauriRemoteAdapter({
      apiBase: 'https://api.devnet.cauri.cc',
      walletUiBase: 'https://devnet.cauri.cc',
    }),
  ],
});

await client.connect({ walletId: 'cauri' });
```

---

## Configuration

| Field | Type | Required | Description |
|---|---|---|---|
| `apiBase` | `string` | yes | Base URL of the Cauri CIP-103 gateway (`/api/dapp` JSON-RPC + SSE) |
| `walletUiBase` | `string` | yes | Base URL of the Cauri wallet UI (`/dapp/connect/<id>` and `/dapp/transaction/<id>`) |
| `name` | `string` | no | Display name in the picker (default: `"Cauri Wallet"`) |

---

## Capabilities

`connect`, `disconnect`, `signTransaction`, `submitTransaction`, `ledgerApi`, `events`, `popup`.

`signMessage`, `switchNetwork`, and `multiParty` are not supported.

---

## License

MIT
