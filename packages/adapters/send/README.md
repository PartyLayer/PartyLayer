# @partylayer/adapter-send

<div align="center">

**Send Canton Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-send.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-send)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for [Send Canton Wallet](https://cantonwallet.com), a passkey-based Canton wallet built by Send Foundation. The wallet ships as a Chrome extension that injects a `window.canton` provider following the splice-wallet-kernel OpenRPC contract; the dApp connection layer is open-sourced as [Sigilry](https://sigilry.org).

> **Note:** This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if you build a custom adapter list.

---

## Status

**Beta.** Send Foundation has indicated that production use is not yet recommended. The package ships as `0.1.0`; the registry entry sets the `beta` flag so dApps render a "Beta" badge automatically.

Send currently operates exclusively on `canton:mainnet`. DevNet support is pending Send Foundation.

---

## Installation

```bash
npm install @partylayer/adapter-send
```

Users must also install the **[Send extension from the Chrome Web Store](https://chromewebstore.google.com/detail/send/ldmohiccoioolenadmogclhoklmanpgi)** for the adapter to detect the wallet.

---

## Quick start

```tsx
import { useConnect } from '@partylayer/react';

function ConnectWithSend() {
  const { connect, isConnecting } = useConnect();
  return (
    <button onClick={() => connect('send')} disabled={isConnecting}>
      {isConnecting ? 'Connecting…' : 'Connect with Send'}
    </button>
  );
}
```

`PartyLayerKit` registers Send automatically — no extra wiring needed.

For explicit registration in a custom adapter list:

```ts
import { createPartyLayer, getBuiltinAdapters, SendAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  appName: 'My dApp',
  adapters: [...getBuiltinAdapters(), new SendAdapter()],
});
```

---

## Capabilities

| Capability          | Send | Notes                                                                                  |
|---------------------|:----:|----------------------------------------------------------------------------------------|
| `connect`           | ✓    | Sigilry `connect` RPC + `getPrimaryAccount`                                            |
| `disconnect`        | ✓    | —                                                                                      |
| `restore`           | ✓    | Silent `status` probe — no popup on page reload                                        |
| `signMessage`       | ✓    | Passkey-signed (WebAuthn-PRF / Touch ID / Face ID)                                     |
| `signTransaction`   | ✗    | Fused into `prepareExecute`; throws `CapabilityNotSupportedError` pointing at submit   |
| `submitTransaction` | ✓    | Via `prepareExecuteAndWait`; receipt populated from `tx.payload.updateId`              |
| `ledgerApi`         | ✓    | Full Sigilry passthrough (matches Console / Nightly)                                   |
| `events`            | ✓    | `txChanged` bridged to PartyLayer `tx:status`                                          |
| `injected`          | ✓    | `window.canton` discovery with kernel.id guard                                         |

---

## Send-specific behaviors

- **Passkey per signature.** Every `signMessage` and every `submitTransaction` triggers a fresh passkey unlock. Send does not cache passkey approval across calls — by design.
- **Mainnet only.** The adapter's `getCapabilities()` declaration is network-agnostic, but Send itself only operates on `canton:mainnet` today.
- **Kernel.id namespace guard.** Send injects at the *bare* `window.canton` slot — the same path any other splice-wallet-kernel-compatible extension uses. The adapter verifies `window.canton.kernel.id === ldmohiccoioolenadmogclhoklmanpgi` (Send's Chrome Web Store ID) before forwarding any RPC. If a foreign provider is sitting at the global, Send adapter cleanly returns "not installed" and yields to the matching adapter.
- **CIP-56 hint.** Submitting a legacy `Amulet_Transfer` exercise on `Splice.Amulet:Amulet` produces an actionable error pointing at the Token Standard `TransferFactory_Transfer` flow. Same hint as the Loop adapter.

---

## References

- [Send (cantonwallet.com)](https://cantonwallet.com)
- [Send Chrome extension](https://chromewebstore.google.com/detail/send/ldmohiccoioolenadmogclhoklmanpgi)
- [Sigilry — open-source dApp SDK powering Send](https://sigilry.org)
- [PartyLayer documentation: Send (Beta)](https://partylayer.xyz/docs/wallets/send)
- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Report issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
