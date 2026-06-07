# @partylayer/adapter-walletconnect

**Opt-in** WalletConnect adapter for PartyLayer. Wraps the official
`@canton-network/dapp-sdk` `WalletConnectAdapter` so dApps can connect Canton
wallets over WalletConnect (hosted/mobile wallets, e.g. Nightly mobile). SIWX,
the `canton_` method mapping, `session_event` handling, and restore all come
from the official adapter — this package only adapts it to PartyLayer's
`WalletAdapter` contract.

## Install (opt-in)

```sh
pnpm add @partylayer/adapter-walletconnect
# install the OPTIONAL WalletConnect peers (only needed when you use WC):
pnpm add @walletconnect/sign-client @walletconnect/types
```

WalletConnect is **not** in `getBuiltinAdapters()`. Register it explicitly:

```ts
import { WalletConnectAdapter } from '@partylayer/adapter-walletconnect';
import { createPartyLayer, getBuiltinAdapters } from '@partylayer/sdk';

const wc = new WalletConnectAdapter({
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  metadata: { name: 'My dApp', description: '…', url: 'https://my.app', icons: ['https://my.app/icon.png'] },
  onUri: (uri) => showQrCode(uri), // wire to your connect modal's QR UI
});

const pl = createPartyLayer({ adapters: [...getBuiltinAdapters(), wc] });
```

## Why dynamic import

`@canton-network/dapp-sdk`'s single barrel entry statically does
`import SignClient from '@walletconnect/sign-client'` (an **optional** peer). A
static import would eagerly pull `@walletconnect/sign-client` and break
webpack/Next consumers that haven't installed it. So this adapter imports the
barrel **only via dynamic `import()`** inside `connect()`/`restore()` — never at
module load. `detectInstalled()` is pure (a `projectId` check), so rendering the
picker never pulls dapp-sdk either. Apps that don't opt in never reference this
package, so they never bundle dapp-sdk or sign-client.

## Notes

- `chainId` is left **unset** by default (per the Canton WC spec: request the
  `canton` namespace and use whatever network the wallet provides).
- Capabilities: `connect, disconnect, restore, signMessage, submitTransaction,
  ledgerApi, events, remoteSigner, deeplink`. `signTransaction` is unsupported
  (Canton WC fuses sign-and-submit via `prepareExecute`).
- **Pending (separate step):** a live WC E2E against a real Canton WC wallet +
  real `projectId` (`NEXT_PUBLIC_WC_PROJECT_ID` / `VITE_WC_PROJECT_ID`). The
  build/tests do not need a `projectId`.
