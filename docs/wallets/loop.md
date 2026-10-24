# Loop wallet integration

Loop is included in the default PartyLayer catalog. Install the React kit and
its React Query peer in one command; no separate Loop package, script tag or
`window.loop` setup is required.

```bash
npm install @partylayer/react @tanstack/react-query
```

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export function WalletUI() {
  return <PartyLayerKit network="devnet" appName="My dApp">
    <ConnectButton />
  </PartyLayerKit>;
}
```

PartyLayer supplies its existing compatibility integration with the official
`@fivenorth/loop-sdk`. This is a popup/QR connection, not the generic CIP-0103
announce path. The reviewed runtime is recorded in the
[wallet matrix](../wallet-cip0103-matrix.md).

## Supported behavior

The integration exposes connect, disconnect, conditional restoration, message
signing, combined transaction submission, transaction events, supported Ledger API
operations and optional intent-level `requestTransfer`. Check the active session's
capabilities rather than assuming a wallet supports a separate `signTransaction`.
Loop combines approval/signing and submission; it has no separate sign-only path
in this integration.

The Ledger API compatibility mapping supports active-contract queries and the
implemented command submission endpoints. Unsupported endpoints throw rather than
being silently rerouted. See [transports](../transports.md) and
[typed transfer support](../typed-transfer-support.md) for the exact boundary.

Restoration uses the vendor's saved session when it remains valid; an expired or
missing authorization requires an explicit reconnect. The wallet's connect result
does not independently report the effective network, so check the network in the
wallet as well as selecting it in the kit. The shipped catalog offers Devnet and
Mainnet; the Loop compatibility mapper does not support Testnet.

## Submission outcomes

An accepted request or acknowledgement is not a confirmed ledger operation.
Preserve the actual wallet update identifier, reconcile the intended operation
independently and keep timeouts unknown. Do not automatically replay writes to get
a better receipt. See [transaction lifecycle](../transaction-lifecycle.md).

A successful message signature tests message signing only. Valid token commands,
instrument issuer/admin, disclosures and protocol-specific swap settlement need
separate acceptance.

## Devnet and troubleshooting

The official [Devnet wallet](https://wallet.devnet.looptech.io) uses a separate
account and balance from Mainnet. Loop's
[integration guide](https://support.looptech.io/en/articles/16925385-how-to-integrate-your-app-with-loop)
states there is no public Devnet/Testnet faucet; request test funding from Loop
with the target network and party ID.

If the popup is blocked, retry from an explicit user click. If approval is
rejected, show rejection without automatically reopening the wallet. If
restoration fails, offer reconnect. An SDK-loading failure should surface as an
integration error; do not ask users to inject an old CDN script.

The observed `Could not unlock private key` error was also reproduced using the
official SDK alone. The reviewed 0.15.1 runtime was current on 2026-10-24. That
establishes the version check and reproduction, not the wallet's underlying key
recovery cause. PartyLayer never asks users to export/import private keys to fix
this issue. Retest with Loop after their wallet/account issue is resolved.

## References

- [Official Loop SDK](https://github.com/fivenorth-io/loop-sdk)
- [Official API reference](https://github.com/fivenorth-io/loop-sdk/blob/main/docs/api-reference.md)
- [Acceptance environments and evidence](../wallet-acceptance.md)
- [Error codes](../errors.md)
