# PartyLayer documentation

Start with the ready-made React connection kit. Supported wallet runtimes are included; no per-wallet PartyLayer package installation is required.

```bash
npm install @partylayer/react @tanstack/react-query
```

This checkout documents the unpublished React 3.1.0 / SDK 0.20.0 candidate. See [release status](./releasing.md#default-wallet-release-validation) before treating candidate behavior as available from npm `@latest`.

## Get started

| Guide | What you will build or learn |
| --- | --- |
| [Quick start](./quick-start.md) | Install once, mount the kit and render the branded Connect Wallet button |
| [New app CLI](../packages/create-partylayer-app/README.md) | Generate React, Next.js, Vue, vanilla or vertical starters |
| [React package](../packages/react/README.md) | Components, hooks, themes and optional data hooks |
| [Framework-independent SDK](../packages/sdk/README.md) | Application-owned wallet picker and client lifecycle |
| [Wallet integration matrix](./wallet-cip0103-matrix.md) | Network, provider, version and capability limits |

## Build your application

- [Authentication](./authentication.md): backend challenges and independent signature/key verification.
- [Transaction lifecycle](./transaction-lifecycle.md): submit once, reconcile and show actual outcomes.
- [Typed transfers](./typed-transfer.md) and [wallet support](./typed-transfer-support.md): exact token/issuer data and wallet-specific command contracts.
- [Wallet balances](./wallet-balances.md): authorized, party/network-bound holdings.
- [Privacy and reads](./privacy-and-reads.md): explicit data-source and authorization boundaries.
- [Multi-party patterns](./multi-party-patterns.md): party-aware application state.
- [API reference](./api.md): client types, methods and events.

## Integrate and operate

- [Protocol ownership and migration](./protocol-ownership.md): native discovery, provider results and cached-session changes.
- [Generic bridge](./generic-bridge.md): custom official providers and compatibility integration.
- [Development and staging](./dev-and-staging.md): local environments and mocks.
- [Production checklist](./production-checklist.md): application responsibilities before launch.
- [Observability](./observability.md) and [performance](./performance.md): diagnose and measure an integration.
- [Release process](./releasing.md), [acceptance evidence](./wallet-acceptance.md) and [roadmap](./platform-roadmap.md): published versus candidate status, automated checks and outstanding manual/live work.

The website at [partylayer.xyz/docs](https://partylayer.xyz/docs) provides the same installation contract and task-oriented guides. English is the documentation language; the wallet UI supports explicit English/Turkish locale settings separately.
