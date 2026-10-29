# Upgrade an existing PartyLayer application

This guide targets React **3.1.2+**, SDK **0.20.1+** and session **1.1.10+**. These are the guide's reviewed baselines, not a promise that every future release is compatible. Commit your working application and lockfile before upgrading; use a branch and a supported test network.

## Choose the scope

| Existing application | Recommended change |
| --- | --- |
| React v1/v2 or manually assembled connection UI | Review the hook mappings below, then adopt one `PartyLayerKit` and the default branded `ConnectButton` where appropriate |
| React 3.1.0/3.1.1 | Upgrade the React package for coordinated cross-tab logout; keep the app's existing working configuration |
| SDK before 0.20 | Review native provider, Ledger API and cache changes below before upgrading |
| Custom React UI with an application-owned client | Keep the advanced provider architecture if intentional; do not add a second kit/client around it |
| Vue, vanilla TypeScript or React Native | Keep the framework's integration; the ready-made React DOM kit is not a Vue or native-mobile component |

The [v1-to-v2 guide](./react-v2-migration.md) documents that historical transition. Use this guide and the [current quick start](./quick-start.md) for the supported setup today. Do not apply a global hook rename without checking the return type and call arguments.

## Install once

In an existing React project:

```bash
npm install @partylayer/react @tanstack/react-query
```

Keep your current package manager and update its existing lockfile. The React kit includes the SDK and supported wallet runtimes. Do not add new per-wallet PartyLayer packages. Remove old direct dependencies only after confirming your application no longer imports them; existing compatibility integrations can remain intentional.

For SDK-only applications, update `@partylayer/sdk` instead of adding a React runtime. No automatic major-version update of every vendor SDK is required: some wallet integrations have intentionally different peer contracts.

## Mount one connection owner

For Next.js App Router, replace the old connection boundary with this **client** provider after transferring its network and wallet configuration. Do not nest it inside an existing PartyLayer provider.

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit } from '@partylayer/react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="devnet" appName="My dApp">
        {children}
      </PartyLayerKit>
    </QueryClientProvider>
  );
}
```

Mount `Providers` once from your server `app/layout.tsx` as shown in the [quick start](./quick-start.md). `QueryClientProvider` is needed for `/query` data hooks; the base connection UI does not need that wrapper. For Vite, mount the kit at the existing React root. Keep WalletConnect/Bron configuration objects stable across renders and preserve application-specific authentication, theme and network choices.

The default UI includes PartyLayer attribution:

```tsx
'use client';

import { ConnectButton, useAccount } from '@partylayer/react';

export default function WalletPanel() {
  const { isConnected, party, networkId } = useAccount();
  return (
    <section>
      <ConnectButton />
      {isConnected && <p>{party} · {networkId}</p>}
    </section>
  );
}
```

## Review hook contracts

| Intent | Current entry point and behavior |
| --- | --- |
| Reactive account/status | `useAccount()` from `@partylayer/react` |
| Reactive session-store view | `useSession()` from `@partylayer/react`; not the old raw SDK session getter |
| Preserve the old SDK session getter | `useClientSession()` from `@partylayer/react` |
| Base imperative connection/actions | Main-entry hooks retain their documented action methods and local state |
| TanStack Query data/mutation hooks | Import from `@partylayer/react/query`, inside your own `QueryClientProvider` |

The two hook entry points are not interchangeable return shapes. For example, the main-entry `useConnect()` exposes `connect(options)`, while query mutations expose TanStack mutation state and methods. Use wallet IDs returned by discovery and the hook's actual TypeScript contract. Read the [hooks reference](https://partylayer.xyz/docs/hooks) before moving an import.

## Preserve CIP-0103 and native session behavior

The official Canton discovery client owns the active native connection. PartyLayer supplies catalog policy, transport boundaries and reactive UI. Do not create a second native provider owner, restore an independent identity from application storage, or access vendor-private fields.

A legacy native UI cache without the official provider hint requires one explicit reconnect. A failed live account/network check must not restore a cached connected account. OneSwap requires a fresh explicit connection. A wallet session is not application authentication.

Native `client.asProvider().request({ method: 'ledgerApi', ... })` now returns the wallet's raw JSON. Remove the old `JSON.parse(result.response)` assumption **only for that native facade path**. `client.ledgerApi()` and existing SDK ledger hooks retain their `{ response: string }` contract; proprietary compatibility projections retain their documented behavior. Native accounts, key metadata and transaction events preserve the wallet's protocol shape. See [protocol ownership](./protocol-ownership.md) for the exact boundary.

Do not automatically resubmit a transaction after a timeout or mismatched command ID. Treat uncertain execution as unknown and reconcile through the application's authorized ledger data source.

## Verify before shipping

1. Build and typecheck the existing app; exercise any changed hook call sites.
2. Check the target network/channel: Send is Mainnet-only; Vala requires Devnet and `channel="beta"`. WalletConnect needs your project ID, and Bron needs your own configuration.
3. Test connect, reject, refresh/restore, account/network changes and disconnect in two tabs. Confirm logout is not resurrected by a UI cache.
4. Test server-verified sign-in separately from message signing. A successful message signature does not establish token transfer or swap settlement.
5. Validate transfers/swaps with valid commands, test funding and independent ledger confirmation on supported networks.

CLI **0.7.0 and newer** include an offline `--doctor` check. CLI 0.7.0 is published on npm; its public installation, diagnostics and generated React application build have been verified. See the [CLI guide](../packages/create-partylayer-app/README.md) for usage and limits. Doctor does not perform wallet or ledger acceptance.
