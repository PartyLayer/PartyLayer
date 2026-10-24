# {{PROJECT_NAME}}

A [PartyLayer](https://partylayer.xyz) dApp: React + Vite, with Canton wallet integration.

## Develop

The CLI installs dependencies unless `--no-install` was selected. If installation
was skipped, run `npm install` first. The connection modal shows **Powered by PartyLayer**
by default.

```bash
npm run dev
```

Open the app and click **Connect Wallet**. The modal lists supported wallets for the configured network and channel.

## How it's wired

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

<PartyLayerKit network="devnet" appName="{{PROJECT_NAME}}">
  <ConnectButton />
</PartyLayerKit>
```

`<PartyLayerKit>` creates the client, loads the supported default wallet catalog, and provides session context. `<ConnectButton>` handles the full connect flow. Read the connected session with `useAccount()`.

Switch networks by changing `network` to `"testnet"` or `"mainnet"` in `src/App.tsx`.

A wallet session is not backend authentication. Use the [authentication guide](https://partylayer.xyz/docs/authentication) for sign-in and independently verify ledger outcomes for transfers/swaps. Send is Mainnet-only in the catalog.

## Build

```bash
npm run build && npm run preview
```

## Docs

- [PartyLayer docs](https://partylayer.xyz/docs)
- [@partylayer/react](https://www.npmjs.com/package/@partylayer/react)

Wallet SDKs are included. Vala requires Devnet with `channel="beta"`. WalletConnect requires your project id through `walletConnect`; Bron requires OAuth/API configuration through `bron`. No separate wallet SDK installation or registration is needed.
