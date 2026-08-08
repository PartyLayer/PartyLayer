# @partylayer/adapter-wintip

<div align="center">

**Wintip Wallet adapter for PartyLayer**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for [Wintip Wallet](https://wallet.wintip.cc), a web-hosted, custodial Canton wallet built by the [Wintip](https://wintip.cc) tipping platform. Wintip Wallet is delivered as a `<script>` tag (no browser extension) that injects a `window.canton` CIP-0103 provider backed by a hidden iframe bridge — the wallet's own approval UI expands into a visible overlay when it needs user input.

Because Wintip is custodial (it holds no per-user signing key), `signMessage` and `signTransaction` are not implemented — money-moving actions go through `submitTransaction` (Wintip's `prepareExecuteAndWait`), which the wallet's own backend executes after its own PIN/passkey approval.

---

## Installation

```bash
npm install @partylayer/adapter-wintip
```

Users connect through the web-hosted wallet — no extension install required. The dApp is responsible for loading the connector script before `connect()` is called:

```html
<script src="https://wallet.wintip.cc/wintip-provider.js"></script>
```

---

## Quick start

```tsx
import { useConnect } from '@partylayer/react';

function ConnectWithWintip() {
  const { connect, isConnecting } = useConnect();
  return (
    <button onClick={() => connect('wintip')} disabled={isConnecting}>
      {isConnecting ? 'Connecting…' : 'Connect with Wintip Wallet'}
    </button>
  );
}
```

For explicit registration in a custom adapter list:

```ts
import { createPartyLayer, getBuiltinAdapters, WintipAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  appName: 'My dApp',
  adapters: [...getBuiltinAdapters(), new WintipAdapter()],
});
```

---

## Capabilities

| Capability | Supported |
| --- | --- |
| `connect` / `disconnect` | ✅ |
| `restore` | ✅ (silent `isConnected()` + `getPrimaryAccount()` probe) |
| `signMessage` | ❌ — no per-user signing key (custodial) |
| `signTransaction` | ❌ — fuses sign-and-submit, use `submitTransaction` |
| `submitTransaction` | ✅ (`prepareExecuteAndWait`) |
| `ledgerApi` | ✅ |
| `events` | ✅ (`txStatus` only, bridged from Wintip's native `txChanged`) |

---

## Links

- [Wintip Wallet developer docs](https://wallet.wintip.cc/docs)
- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Report Issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
