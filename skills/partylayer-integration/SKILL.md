---
name: partylayer-integration
description: Add or upgrade PartyLayer wallet connectivity in Canton applications using the maintained kit, SDK and CIP-0103 contracts. Use for PartyLayer setup and migration, not generic wallet development.
---

# PartyLayer integration

Inspect the application's framework, package manager, installed versions and existing connection boundary first. Preserve working configuration and the user's chosen network, UI and authentication. This skill supplies integration guidance; it does not authorize publication, credential access, wallet approval or ledger writes.

## Pick the maintained path

- For a new app, use the [CLI guide](../../packages/create-partylayer-app/README.md). Its six starters differ by framework and use case.
- For an existing React DOM app, use the complete [quick start](../../docs/quick-start.md). Install `@partylayer/react` and `@tanstack/react-query` together using the existing package manager. Supported wallet runtimes are included; do not add a new per-wallet PartyLayer package.
- For an upgrade, read the [current migration guide](../../docs/migration.md) before changing providers, hook imports or native Ledger API consumers. Do not treat the historical v1-to-v2 guide as current setup.
- For Vue, vanilla TypeScript or React Native, follow the framework's public package and [SDK reference](../../packages/sdk/README.md). Do not render React DOM components in a different framework.

In a downloaded copy of this skill without the repository, use [the quick start](https://partylayer.xyz/docs/quick-start), [migration](https://partylayer.xyz/docs/migration), [installation](https://partylayer.xyz/docs/installation) and [the full text reference](https://partylayer.xyz/llms-full.txt). Check deployed reference versions against the application's lockfile; do not silently upgrade all vendor SDKs.

## Preserve connection and API contracts

Use one `PartyLayerKit` at the React application boundary and the default branded `ConnectButton` unless the user chose custom UI. An existing advanced `PartyLayerProvider` with an application-owned client does not need a second kit/client. Keep runtime configuration objects stable. For Next.js App Router, put wallet providers/components in a client component and keep the root layout server-side. Optional `/query` hooks require the app's own stable `QueryClientProvider`; their TanStack mutation methods differ from main-entry imperative hooks.

Use wallet IDs and capabilities from discovery. Send is Mainnet-only; Vala requires Devnet and the beta channel. WalletConnect requires the application's project ID and Bron its own OAuth/API settings. Catalog inclusion is not live acceptance. See the [wallet matrix](../../docs/wallet-cip0103-matrix.md).

Keep one official discovery owner for native CIP-0103. Preserve real accounts/key metadata, network, events and raw provider responses. A native `asProvider()` Ledger API response differs from the SDK `ledgerApi()` string envelope; consult [protocol ownership](../../docs/protocol-ownership.md). Do not introduce a private vendor-field dependency, a second restored identity or fabricated transaction lifecycle events. Native UI caches are not authorization and may require explicit reconnect after migration.

For application sign-in, read [authentication](../../docs/authentication.md). A connection or message signature alone is not independently verified login. For transfers/swaps, read [transaction lifecycle](../../docs/transaction-lifecycle.md) and [typed transfer contracts](../../docs/typed-transfer.md). The application constructs valid commands and confirms outcomes against an authorized ledger source; do not invent universal swap payloads or automatically retry uncertain writes.

## Verify the actual application

Run the application's existing build/typecheck and relevant tests. CLI 0.7.0 introduces read-only `--doctor [dir] [--json]`; confirm it has been published/installed before invoking it. Its offline metadata report is not a wallet, network, signing or ledger test. Report concrete checks separately from deferred user login, vendor setup and live settlement. Never infer that every AI-generated integration works because documentation examples compile.
