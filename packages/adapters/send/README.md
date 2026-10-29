# @partylayer/adapter-send

> **Default application integration:** The React kit already includes this compatibility
> runtime where applicable. Install `@partylayer/react @tanstack/react-query` in one
> command and use `PartyLayerKit` with `ConnectButton`; no per-wallet package
> installation is required. See [the quick start](https://partylayer.xyz/docs/quick-start).
> The instructions below are for explicitly using this standalone compatibility package.
> Native provider paths and limits are recorded in the [integration matrix](https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-cip0103-matrix.md).

> **Legacy integration.** This package predates the generic bridge and is kept for
> compatibility; a new wallet should not copy this pattern. New wallets integrate
> through Path A or Path B with no PartyLayer-specific code, see
> <https://partylayer.xyz/docs/generic-bridge>.

<div align="center">

**Send Canton Wallet adapter for PartyLayer**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-send.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-send)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

Adapter for [Send](https://cantonwallet.com), a passkey-based Canton wallet. Send is delivered as a browser extension that injects a `window.canton` provider following the splice-wallet-kernel OpenRPC contract; the dApp connection layer is open-sourced as [Sigilry](https://sigilry.org).

> **Note:** This adapter is included in `@partylayer/sdk` by default. You only need to install it separately if you build a custom adapter list.

---

## Installation

```bash
npm install @partylayer/adapter-send
```

Users connect through a browser extension. Direct them to [sigilry.org](https://sigilry.org) for current installation instructions before they can connect.

---

## Quick start

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <PartyLayerKit network="mainnet" appName="My Canton dApp">
      <ConnectButton />
    </PartyLayerKit>
  );
}
```

`PartyLayerKit` discovers Send through CIP-0103 automatically; no separate wallet
package or registration is needed. Send supports Mainnet, so it is not offered
in a Devnet wallet list. The wallet extension must be installed and unlocked.

For an existing application, place the kit around your application instead of
adding another kit inside a child component. See the [quick start](https://partylayer.xyz/docs/quick-start).

For advanced compatibility setups that explicitly supply the Send runtime:

```ts
import { createPartyLayer, SendAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My Canton dApp' },
  adapters: [new SendAdapter()],
});
// Call from your Connect button's click handler.
export async function connectWallet() {
  const wallet = (await client.listWallets()).find(wallet => wallet.walletId === 'send');
  if (!wallet) throw new Error('send is unavailable on this network');
  return client.connect({ walletId: wallet.walletId });
}
```

The `adapters` option replaces the default wallet catalog. Omit it
for the standard catalog and native CIP-0103 discovery; do not register the same
wallet runtime twice.

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
| `injected`          | ✓    | `window.canton` discovery with registry-driven detection guard                         |

---

## CIP-0103 compliance

`@partylayer/adapter-send` is a CIP-0103 native adapter. It exposes the Send wallet's `window.canton` provider through PartyLayer's standard `WalletAdapter` interface so the same dApp code that talks to any other CIP-0103 wallet (Console, Loop, Nightly, Cantor8) also talks to Send.

The adapter:

- Maps every Sigilry RPC method (`status`, `connect`, `disconnect`, `getPrimaryAccount`, `signMessage`, `prepareExecute`, `prepareExecuteAndWait`, `ledgerApi`) onto the PartyLayer capability surface declared in `getCapabilities()`.
- Bridges Send's `txChanged` event into PartyLayer's `tx:status` channel so transaction subscribers receive the same shape regardless of which wallet is connected.
- Routes structured JSON-RPC errors (4001 user-rejected, 4100/4900/4901 transport, -32601 method-not-supported) onto the canonical PartyLayer error taxonomy (`UserRejectedError`, `TransportError`, `CapabilityNotSupportedError`), so existing error-handling branches in dApp code continue to work without modification.

---

## Detection

The Send adapter detects whether the running browser has a compatible Send install via the registry's `providerDetection` rules. The same `window.canton` slot is shared with other splice-wallet-kernel-compatible extensions, so the adapter funnels every RPC call through a guard that verifies the live provider matches Send's detection rule before forwarding.

When detection fails — Send is not installed, or another Canton wallet is currently occupying `window.canton` — the adapter raises a typed error consumers can branch on:

- `SendNotInstalledError` (subclass of `WalletNotInstalledError`) — surfaced from `detectInstalled()` and from any RPC call when `window.canton` is absent. Carries `details.installUrl` so a dApp can present a single click-through to the Send wallet homepage.
- `SendKernelMismatchError` (also a subclass of `WalletNotInstalledError`) — surfaced when `window.canton` is present but its identity doesn't match Send. The adapter cleanly returns "not installed" so any other CIP-0103 adapter present in the registry can claim the active provider instead.
- `SendAuthTimeoutError` — surfaced when Send's authentication backend is unreachable or slow. Carries `details.cause = 'send-auth-timeout'` plus `retry: true` so a dApp can present a "try again" affordance rather than treating the failure as a permanent error.

---

## Compatibility

| Requirement          | Value                                                  |
|----------------------|--------------------------------------------------------|
| Browser              | Chromium-based browsers with WebAuthn-PRF support      |
| Authentication       | Passkey (Touch ID / Face ID / platform authenticator)  |
| Canton network       | `canton:mainnet`                                        |
| `@partylayer/sdk`    | `>=0.3.6`                                              |

---

## Send-specific behaviors

- **Passkey per signature.** Every `signMessage` and every `submitTransaction` triggers a fresh passkey unlock. Send does not cache passkey approval across calls — by design.
- **Sign-and-submit are fused.** Send does not expose a standalone `signTransaction` step. The adapter mirrors that: `signTransaction()` throws `CapabilityNotSupportedError` pointing at `submitTransaction()` (`prepareExecuteAndWait` under the hood).
- **CIP-56 hint.** Submitting a legacy `Amulet_Transfer` exercise on `Splice.Amulet:Amulet` produces an actionable error pointing at the Token Standard `TransferFactory_Transfer` flow. Same hint as the Loop adapter.

---

## References

- [Send (cantonwallet.com)](https://cantonwallet.com)
- [Sigilry — open-source dApp SDK powering Send](https://sigilry.org)
- [PartyLayer documentation: Send](https://partylayer.xyz/docs/wallets/send)
- [GitHub Repository](https://github.com/PartyLayer/PartyLayer)
- [Report issues](https://github.com/PartyLayer/PartyLayer/issues)

---

## License

MIT
