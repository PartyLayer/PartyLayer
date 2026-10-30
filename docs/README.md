# PartyLayer documentation

Start with the ready-made React connection kit. Supported wallet runtimes are included; no per-wallet PartyLayer package installation is required.

```bash
npm install @partylayer/react @tanstack/react-query
```

These guides cover React 3.1.0+ / SDK 0.20.0+. See [release status](./releasing.md#default-wallet-release-validation) for publication and acceptance evidence.

## Get started

| Guide | What you will build or learn |
| --- | --- |
| [Upgrade an existing app](./migration.md) | Migrate hooks, providers and native sessions without duplicating connection owners |
| [AI-assisted integration](./ai-integration.md) | Give coding assistants maintained setup instructions and review generated code |
| [Quick start](./quick-start.md) | Install once, mount the kit and render the branded Connect Wallet button |
| [Framework support](https://partylayer.xyz/docs/installation#framework-support) | Choose React, Next.js, Vue/Nuxt, a custom web stack or React Native and understand their UI/runtime limits |
| [New app CLI](../packages/create-partylayer-app/README.md) | Generate React, Next.js, Vue, vanilla or vertical starters |
| [React package](../packages/react/README.md) | Components, hooks, themes and optional data hooks |
| [Framework-independent SDK](../packages/sdk/README.md) | Application-owned wallet picker and client lifecycle |
| [Wallet integration matrix](./wallet-cip0103-matrix.md) | Network, provider, version and capability limits |

- [RainbowKit for Canton](https://partylayer.xyz/docs/rainbowkit-for-canton): React connection UI and Canton-specific requirements.
- [Integration support](https://partylayer.xyz/docs/integration-support): application help, wallet-provider contributions and verified references.
- [AI coding reference](https://partylayer.xyz/llms-full.txt) and [documentation index](https://partylayer.xyz/llms.txt): generated plain-text setup, SDK usage and wallet network requirements for coding assistants.

## Build your application

- [Authentication](./authentication.md): backend challenges and independent signature/key verification.
- [Transaction lifecycle](./transaction-lifecycle.md): submit once, reconcile and show actual outcomes.
- [Swap integration](./swaps.md): protocol quotes, approval, ledger reconciliation and output/refund acceptance.
- [Typed transfers](./typed-transfer.md) and [wallet support](./typed-transfer-support.md): exact token/issuer data and wallet-specific command contracts.
- [Wallet balances](./wallet-balances.md): authorized, party/network-bound holdings.
- [Ready wallet ledger reader](./wallet-ledger-reader.md): authenticated v2 holdings and update/command correlation.
- [Privacy and reads](./privacy-and-reads.md): explicit data-source and authorization boundaries.
- [Multi-party patterns](./multi-party-patterns.md): party-aware application state.
- [API reference](./api.md): client types, methods and events.

## Integrate and operate

- [Protocol ownership and migration](./protocol-ownership.md): native discovery, provider results and cached-session changes.
- [Generic bridge](./generic-bridge.md): custom official providers and compatibility integration.
- [Development and staging](./dev-and-staging.md): local environments and mocks.
- [Production checklist](./production-checklist.md): application responsibilities before launch.
- [Observability](./observability.md) and [performance](./performance.md): diagnose and measure an integration.
- [Dependency maintenance](./dependency-maintenance.md): framework compatibility, clean-consumer audits and explicitly tracked upstream findings.
- [Owner-approved npm releases](./trusted-publishing.md): one protected owner approval, tokenless publication, per-package activation checks and the legacy staged alternative.
- [Release process](./releasing.md), [acceptance evidence](./wallet-acceptance.md) and [roadmap](./platform-roadmap.md): published versus candidate status, automated checks and outstanding manual/live work.

[Developer discovery and adoption roadmap](./growth/roadmap.md) covers npm/GitHub/search visibility, public measurement and verified integration references.

The website at [partylayer.xyz/docs](https://partylayer.xyz/docs) provides the same installation contract and task-oriented guides. English is the documentation language; the wallet UI supports explicit English/Turkish locale settings separately.
