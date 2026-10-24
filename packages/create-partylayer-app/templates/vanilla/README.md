# {{PROJECT_NAME}}

A Canton dApp using TypeScript, Vite and `@partylayer/sdk`. This template provides
its own connection UI with **Powered by PartyLayer** attribution. React apps can
use the ready-made kit and `ConnectButton` instead.

## Develop

The CLI installs dependencies unless `--no-install` was selected. If needed, run
`npm install`, then:

```bash
npm run dev
```

## How it works

`src/main.ts` creates the client, renders its wallet list and handles connection
from a user click. The SDK includes supported runtimes; no separate wallet package
installation is required.

```ts
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: '{{PROJECT_NAME}}' },
});

const wallets = await client.listWallets();
// Connect the selected entry from a user click handler:
// await client.connect({ walletId: selectedWallet.walletId });

const active = await client.getActiveSession();
// A saved cache alone never establishes a live connection.
```

Dispose the application-owned client with `client.destroy()` when its owner is
removed. Use `client.disconnect()` for an explicit wallet disconnect.

## Wallet configuration

Change the `createPartyLayer` options in `src/main.ts`:

- `network: 'devnet'`, `'testnet'` or `'mainnet'` filters the catalog.
- Vala requires `network: 'devnet', channel: 'beta'`.
- Send is Mainnet-only in the catalog.
- WalletConnect needs `walletConnect: { projectId: 'YOUR_PROJECT_ID' }`.
- Bron needs application-owned OAuth/API configuration through `bron`.
- `additionalAdapters` extends defaults; `adapters` replaces them.

Wallet accounts, login/approval and test funding remain prerequisites. A returned
message signature is not proof of a transfer, swap or authenticated backend login.

## Build

```bash
npm run build
npm run preview
```

## Documentation

- [Framework-independent SDK](https://partylayer.xyz/docs/vanilla-js)
- [Wallet configuration](https://partylayer.xyz/docs/wallets)
- [Authentication](https://partylayer.xyz/docs/authentication)
- [Transaction lifecycle](https://partylayer.xyz/docs/transaction-lifecycle)
