# Dev and Staging: From Zero to a Working Integration

This guide is the practical path for a team integrating PartyLayer, from a first look
with nothing installed, through local development against a mock wallet, to a real
connection on devnet, and finally to staging and production. It consolidates the steps
that are otherwise spread across the quick start, the testing package, and the Studio
workbench into one ordered walkthrough.

A quick orientation first. PartyLayer is a wallet connection SDK that implements
CIP-0103. It connects the user's wallet, requests signatures, and relays a prepared
transaction to the wallet for submission. It is not a ledger bridge and not a validator,
so nothing in this guide asks you to host a party or stand up ledger infrastructure on
PartyLayer's side. For where your DAML packages live and why, see
[PartyLayer and Canton Topology](./partylayer-and-canton-topology.md).

---

## Step 1: Explore with zero install (PartyLayer Studio)

The fastest first look is [PartyLayer Studio](https://studio.partylayer.xyz), a Sandpack
workbench that runs in the browser with nothing to install. It ships seven runnable
scenarios against a mock CIP-0103 wallet:

- Connect a wallet and read the session.
- Sign a message.
- Submit a prepared transaction.
- Session resilience (reconnect and restore behavior).
- React Query integration, including the DevTools panel.
- A React, Vue, and Vanilla toggle, so you can see the same flow in each binding.

Studio is the best way to see the full surface end to end before you write any code. You
can change the scenario, edit the code live, and watch the mock wallet respond, all
without a real wallet or a network.

---

## Step 2: Local development against a mock (@partylayer/testing)

When you start writing your integration, build and test it offline against a mock wallet
first. The `@partylayer/testing` package provides a mock CIP-0103 provider with:

- Failure scenarios, so you can exercise the error paths (user rejection, timeouts,
  disconnects) deterministically, not just the happy path.
- Transaction and session lifecycle simulation, so you can drive a connect, sign, submit,
  and restore sequence without a wallet extension.
- TanStack Query helpers, so your query based code (the cost and DAML composables, the
  React Query hooks) can be tested with a controlled cache.

It has two entrypoints:

- `@partylayer/testing` (the `.` entry): the mock provider and lifecycle helpers.
- `@partylayer/testing/query` (the `./query` entry): the TanStack Query test helpers.

```bash
npm install --save-dev @partylayer/testing
```

The goal of this step is confidence: prove your whole integration works, including the
error paths, against a wallet you fully control, before you ever touch a real one. The
mock implements the same CIP-0103 surface the real wallets do, so code that works here
works against a real wallet too.

---

## Step 3: Connect to devnet

Once the integration holds up against the mock, point it at a real network. Install the
binding for your framework and wrap your app:

```bash
# React
npm install @partylayer/react
# Vue
npm install @partylayer/vue
# Vanilla / custom
npm install @partylayer/sdk
```

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectButton />
      <YourApp />
    </PartyLayerKit>
  );
}
```

Native CIP-0103 wallets injected at `window.canton.*` are auto-discovered at runtime, so
any compliant wallet the user has installed appears in the picker with no adapter to
write. For the full set of call signatures, the hooks based custom UI, and the Vanilla
JavaScript path, see the [Quick Start Guide](./quick-start.md). For ready made recipes,
see the Pattern Cookbook in the package READMEs.

---

## Step 4: Staging and production

Moving from devnet to testnet to mainnet is a configuration change, not a code change.
The network is selected by the `network` prop on `PartyLayerKit` (or the `network` field
in `createPartyLayer({ ... })` for the SDK path):

```tsx
<PartyLayerKit network="mainnet" appName="My dApp">
  <ConnectButton />
</PartyLayerKit>
```

What changes between environments is which network the wallet connects to and which
wallets support it. What does not change is your integration code: the same hooks,
components, and call surface work across all three networks. Because wallet network
support varies, check the per-wallet network support matrix, which lives in the README
and in [docs/wallet-cip0103-matrix.md](./wallet-cip0103-matrix.md), to confirm the
wallets you care about support your target network.

One thing PartyLayer does not do at this step is move or vet your DAML packages. Where
your DARs must live is a Canton topology question that is independent of which PartyLayer
network you select. See
[PartyLayer and Canton Topology](./partylayer-and-canton-topology.md) before you ship to
staging if your dApp uses your own templates.

---

## Current versions

This guide targets the current release line:

- `@partylayer/react@2.0.0`: TanStack Query v5 integration, the `/query` entrypoint with
  the query backed hooks and their Suspense twins.
- `@partylayer/vue@1.0.0`: the first stable Vue 3 release, with API parity to React.
- Both depend on `@partylayer/core@0.10.0`, which carries the CIP-0104 cost types.

If you are upgrading a React integration from the v1 line, see the
[React v2 migration guide](./react-v2-migration.md).

---

## See also

- [Quick Start Guide](./quick-start.md)
- [Architecture](./architecture.md)
- [PartyLayer and Canton Topology](./partylayer-and-canton-topology.md)
- [React v2 migration guide](./react-v2-migration.md)
