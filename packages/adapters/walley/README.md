# @partylayer/adapter-walley

<div align="center">

**Walley Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-walley.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-walley)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for [Walley](https://walley.cc), a self-custodial Canton wallet. Walley's signing key is an Ed25519 pair derived in the browser from a WebAuthn passkey — no private key leaves the user's device. dApps connect through a popup the wallet opens for `connect`, `signMessage`, and transaction approval, exchanging JSON-RPC over `postMessage`. The connection layer is published as [`@k2flabs/walley-dapp-sdk`](https://www.npmjs.com/package/@k2flabs/walley-dapp-sdk).

> **Note:** This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if you build a custom adapter list.

---

## Installation

```bash
npm install @partylayer/adapter-walley
```

---

## Quick start

```tsx
import { useConnect } from '@partylayer/react';

function ConnectWithWalley() {
  const { connect, isConnecting } = useConnect();
  return (
    <button onClick={() => connect('walley')} disabled={isConnecting}>
      {isConnecting ? 'Connecting…' : 'Connect with Walley'}
    </button>
  );
}
```

`PartyLayerKit` registers Walley automatically — no extra wiring needed.

For explicit registration in a custom adapter list:

```ts
import { createPartyLayer, getBuiltinAdapters, WalleyAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  appName: 'My dApp',
  adapters: [...getBuiltinAdapters(), new WalleyAdapter()],
});
```

The adapter targets the hosted Walley wallet at [walley.cc](https://walley.cc).

---

## Capabilities

| Capability          | Walley | Notes                                                                          |
|---------------------|:------:|--------------------------------------------------------------------------------|
| `connect`           | ✓      | Popup approval → party id + short-lived ledger access token                     |
| `disconnect`        | ✓      | Clears the local session                                                        |
| `restore`           | ✓      | Rebuilds the session from persisted state — no popup on reload                   |
| `signMessage`       | ✓      | Passkey-signed (WebAuthn-PRF / Touch ID / Face ID)                              |
| `signTransaction`   | ✗      | Fused into submit; throws `CapabilityNotSupportedError` pointing at `submitTransaction` |
| `submitTransaction` | ✓      | Via `prepareExecuteAndWait`                                                      |
| `ledgerApi`         | ✓      | Read-only Ledger API proxied with the session's bearer token                    |
| `popup`             | ✓      | Popup transport, origin-checked against the wallet host                         |

---

## Walley-specific behaviors

- **Self-custody.** Keys are derived in the user's browser from a passkey and never leave the device. The adapter holds no key material — it only relays approvals.
- **Passkey per approval.** Every `signMessage` and `submitTransaction` triggers a fresh passkey prompt; approval is not cached across calls.
- **Sign-and-submit are fused.** Walley has no standalone `signTransaction` step. The adapter mirrors that: `signTransaction()` throws `CapabilityNotSupportedError` pointing at `submitTransaction()` (`prepareExecuteAndWait` under the hood).
- **Self-hosting (advanced).** Pass `new WalleyAdapter({ host })` to point at a self-hosted Walley instead of the hosted wallet.

---

## Compatibility

| Requirement       | Value                                              |
|-------------------|----------------------------------------------------|
| Browser           | Any browser with WebAuthn passkey support          |
| Authentication    | Passkey (Touch ID / Face ID / platform authenticator) |
| Canton network    | `devnet`, `testnet`, `mainnet`                      |
| `@partylayer/sdk` | `>=0.7.0`                                          |

---

## References

- [Walley (walley.cc)](https://walley.cc)
- [`@k2flabs/walley-dapp-sdk`](https://www.npmjs.com/package/@k2flabs/walley-dapp-sdk)
- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Report issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
