# {{PROJECT_NAME}}

A [PartyLayer](https://partylayer.xyz) dApp — React + Vite, with Canton wallet integration.

## Develop

```bash
npm run dev
```

Open the app and click **Connect Wallet** — the modal lists every verified Canton wallet from the registry.

## How it's wired

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

<PartyLayerKit network="devnet" appName="{{PROJECT_NAME}}">
  <ConnectButton />
</PartyLayerKit>
```

`<PartyLayerKit>` creates the client, registers all built-in wallet adapters, and provides session context. `<ConnectButton>` handles the full connect flow. Read the connected session with `useAccount()`.

Switch networks by changing `network` to `"testnet"` or `"mainnet"` in `src/App.tsx`.

## Build

```bash
npm run build && npm run preview
```

## Docs

- [PartyLayer docs](https://partylayer.xyz/docs/introduction)
- [@partylayer/react](https://www.npmjs.com/package/@partylayer/react)
