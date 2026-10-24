# Quick start

Add PartyLayer's branded wallet picker and account menu to a React app. One npm command installs the kit, SDK and reviewed wallet runtimes. No wallet-specific imports or stylesheet import are required.

> **Version scope:** This guide requires React **3.1.0+** / SDK **0.20.0+**. See [release status](./releasing.md#default-wallet-release-validation) for publication and acceptance evidence.

Use React 18+ in an existing application. Use a supported Node LTS version that meets your framework's requirements. Users need a wallet account or extension for the selected network to finish a real connection.

## Start a new app

If you do not have an app yet:

```bash
npm create partylayer-app@latest my-dapp -- --template react-vite --pm npm
cd my-dapp
npm run dev
```

The CLI generates the project and installs dependencies. Use `--template next-ssr` for Next.js App Router. See the [CLI guide](../packages/create-partylayer-app/README.md) for all six templates. Generated React apps already use the PartyLayer button and default attribution.

For an existing app, follow the steps below.

## Step 1: Install

Run this in your React project:

```bash
npm install @partylayer/react @tanstack/react-query
```

Use `pnpm add` or `yarn add` with the same package names if preferred. You do not need to install `@partylayer/sdk`, core packages or individual wallet SDKs separately.

TanStack Query is a required peer. The base connect UI works without `QueryClientProvider`; add that provider when using `@partylayer/react/query` data hooks.

## Step 2: Mount the kit

For a Vite React app, wrap the application in `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartyLayerKit } from '@partylayer/react';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PartyLayerKit network="devnet" appName="My dApp">
      <App />
    </PartyLayerKit>
  </StrictMode>,
);
```

For Next.js App Router, create a client provider in `app/providers.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { PartyLayerKit } from '@partylayer/react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      {children}
    </PartyLayerKit>
  );
}
```

Mount it in `app/layout.tsx`. Keep this file a Server Component:

```tsx
import type { ReactNode } from 'react';
import { Providers } from './providers';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```

Use one kit at your application boundary. It owns discovery, client cleanup, theme and session context. Keep `walletConnect`, `bron` and `additionalAdapters` configuration objects stable outside render or with `useMemo`; changes recreate the client.

## Step 3: Add ConnectButton

In Vite, use `src/App.tsx`. In Next.js, use `app/page.tsx` with the client directive:

```tsx
'use client';

import { ConnectButton } from '@partylayer/react';

export default function Home() {
  return (
    <main>
      <h1>My Canton dApp</h1>
      <ConnectButton />
    </main>
  );
}
```

Users can open the picker, choose an available wallet and approve its connection. The connected button opens the account menu. The modal shows **Powered by PartyLayer** by default. Hosted-wallet login and extension installation are handled by the wallet.

## Read the connected account

```tsx
import { useAccount } from '@partylayer/react';

export function Account() {
  const { isConnected, status, party, networkId } = useAccount();
  if (!isConnected) return <p>Wallet: {status}</p>;
  return <p>{party} · {networkId}</p>;
}
```

Render this inside the kit. A wallet session is not application authentication; use the [authentication guide](./authentication.md) for server-verified sign-in.

For optional data hooks, wrap the kit in `QueryClientProvider`. In a Next.js client provider, create a stable `QueryClient` with `useState(() => new QueryClient())` rather than sharing one across server requests. See [data hooks](https://partylayer.xyz/docs/hooks#query-hooks).

## Configure wallets

| Need | Setting |
| --- | --- |
| Development network | `network="devnet"` |
| Testnet or Mainnet | Set `network` explicitly; the wallet list follows catalog network support |
| Vala | `network="devnet" channel="beta"` |
| Send | `network="mainnet"`; absent from the Devnet catalog |
| WalletConnect | `walletConnect={walletConnect}` with your own project ID |
| Bron | `bron={bron}` with your OAuth/API configuration |
| Add custom integrations | `additionalAdapters={customAdapters}` |
| Replace the default catalog | `adapters={customAdapters}` |
| Theme and language | `theme="auto" locale="en"`; Turkish and explicit RTL are supported |

For example, enable WalletConnect without an extra wallet package:

```tsx
const walletConnect = { projectId: 'YOUR_PROJECT_ID' };

<PartyLayerKit network="devnet" appName="My dApp" walletConnect={walletConnect}>
  <ConnectButton />
</PartyLayerKit>
```

Supported runtimes ship with the kit and load as needed. A registry listing or capability declaration is not proof of completed live testing. Check the [wallet matrix](./wallet-cip0103-matrix.md) and [release evidence](./releasing.md#default-wallet-release-validation).

## Verify the connection

1. Open Connect Wallet and check that wallets match the selected network/channel.
2. Select a wallet from the button's user-initiated flow. Complete login, installation and approval if required.
3. Confirm `useAccount()` reports a party and the actual wallet network.
4. Disconnect and check that the account UI clears. Reload and test restoration separately: a stored hint alone does not prove the wallet is connected.

A successful connection or message signature does not verify a token transfer or swap. Your app needs valid commands, test balance and independent ledger confirmation for those operations.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A wallet is missing | Network/channel support, WalletConnect/Bron configuration and whether `adapters` replaced the defaults. Send is Mainnet-only; Vala requires Devnet beta. |
| Wallet picker is empty | Registry/discovery errors, network/channel filters and custom adapter configuration. A failed registry fetch is only one possible cause. |
| Popup does not open | Start the flow directly from a user click and check popup blocking. Use the default button to preserve the supported popup flow. |
| Wallet rejects signing | Check the connected session's capabilities, network and current wallet authentication. Preserve the wallet's error when diagnosing a deployment problem. |
| Backend rejects a signature | Verify the exact challenged message/encoding, nonce, origin and independently authorized key. Do not infer a universal wallet algorithm. |
| Old native session is not restored | This release requires one reconnect for old caches without an official provider hint. Live party/network checks still apply. |
| Next.js hydration differs | Keep the kit in a client boundary. Treat SSR cookie state as a UI hint; use backend-verified sessions for protected server content. |

## Next steps

- [Kit configuration](https://partylayer.xyz/docs/partylayer-kit) and [ConnectButton](https://partylayer.xyz/docs/connect-button).
- [Authentication](./authentication.md), [transaction lifecycle](./transaction-lifecycle.md) and [wallet balances](./wallet-balances.md).
- [Token transfer support](./typed-transfer-support.md), including valid command and issuer requirements.
- [Protocol ownership and migration](./protocol-ownership.md) for existing integrations.
- [Framework-independent SDK](../packages/sdk/README.md) or [Vue bindings](../packages/vue/README.md) for other application stacks.
