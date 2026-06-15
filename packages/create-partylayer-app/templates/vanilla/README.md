# {{PROJECT_NAME}}

A [PartyLayer](https://partylayer.xyz) dApp — vanilla TypeScript + Vite, no framework.

## Develop

```bash
npm run dev
```

## How it's wired

```ts
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet', app: { name: '{{PROJECT_NAME}}' } });

const wallets = await client.listWallets();        // verified wallets from the registry
const session = await client.connect({ walletId }); // connect to one
client.on('session:connected', () => { /* … */ });  // react to session changes
client.on('session:disconnected', () => { /* … */ });
const active = await client.getActiveSession();      // restore on load
```

`createPartyLayer` is the dApp connect API — no framework bindings needed. See `src/main.ts` for the full hand-rolled connect UI. Switch networks by changing `network` to `"testnet"` or `"mainnet"`.

## Build

```bash
npm run build && npm run preview
```

## Docs

- [PartyLayer docs](https://partylayer.xyz/docs/introduction)
- [@partylayer/sdk](https://www.npmjs.com/package/@partylayer/sdk)
