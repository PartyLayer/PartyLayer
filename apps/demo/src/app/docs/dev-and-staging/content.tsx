'use client';

import { useDocs } from '../layout';

export default function DevAndStagingContent() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, UL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>Dev and Staging: From Zero to a Working Integration</H1>
      <P>
        This guide is the practical path for a team integrating PartyLayer, from a first look with
        nothing installed, through local development against a mock wallet, to a real connection on
        devnet, and finally to staging and production. It consolidates the steps that are otherwise
        spread across the quick start, the testing package, and the Studio workbench into one ordered
        walkthrough.
      </P>
      <Callout type="note" title="What PartyLayer is here">
        PartyLayer is a wallet connection SDK that implements CIP-0103. It connects the user&apos;s
        wallet, requests signatures, and relays a prepared transaction to the wallet for submission.
        It is not a ledger bridge and not a validator, so nothing in this guide asks you to host a
        party or stand up ledger infrastructure on PartyLayer&apos;s side. For where your DAML
        packages live and why, see{' '}
        <A href="/docs/partylayer-and-canton-topology">PartyLayer and Canton Topology</A>.
      </Callout>

      <H2 id="step-1-studio">Step 1: Explore with zero install (PartyLayer Studio)</H2>
      <P>
        The fastest first look is <A href="https://studio.partylayer.xyz">PartyLayer Studio</A>, a
        Sandpack workbench that runs in the browser with nothing to install. It ships seven runnable
        scenarios against a mock CIP-0103 wallet:
      </P>
      <UL>
        <LI>Connect a wallet and read the session.</LI>
        <LI>Sign a message.</LI>
        <LI>Submit a prepared transaction.</LI>
        <LI>Session resilience (reconnect and restore behavior).</LI>
        <LI>React Query integration, including the DevTools panel.</LI>
        <LI>A React, Vue, and Vanilla toggle, so you can see the same flow in each binding.</LI>
      </UL>
      <P>
        Studio is the best way to see the full surface end to end before you write any code. You can
        change the scenario, edit the code live, and watch the mock wallet respond, all without a real
        wallet or a network.
      </P>

      <H2 id="step-2-mock">Step 2: Local development against a mock</H2>
      <P>
        When you start writing your integration, build and test it offline against a mock wallet
        first. The <Code>{'@partylayer/testing'}</Code> package provides a mock CIP-0103 provider with:
      </P>
      <UL>
        <LI>
          Failure scenarios, so you can exercise the error paths (user rejection, timeouts,
          disconnects) deterministically, not just the happy path.
        </LI>
        <LI>
          Transaction and session lifecycle simulation, so you can drive a connect, sign, submit, and
          restore sequence without a wallet extension.
        </LI>
        <LI>
          TanStack Query helpers, so your query based code (the cost and DAML composables, the React
          Query hooks) can be tested with a controlled cache.
        </LI>
      </UL>
      <P>It has two entrypoints:</P>
      <UL>
        <LI>
          <Code>{'@partylayer/testing'}</Code> (the <Code>{'.'}</Code> entry): the mock provider and
          lifecycle helpers.
        </LI>
        <LI>
          <Code>{'@partylayer/testing/query'}</Code> (the <Code>{'./query'}</Code> entry): the
          TanStack Query test helpers.
        </LI>
      </UL>
      <CodeBlock language="bash">{`npm install --save-dev @partylayer/testing`}</CodeBlock>
      <P>
        The goal of this step is confidence: prove your whole integration works, including the error
        paths, against a wallet you fully control, before you ever touch a real one. The mock
        implements the same CIP-0103 surface the real wallets do, so code that works here works
        against a real wallet too.
      </P>

      <H2 id="step-3-devnet">Step 3: Connect to devnet</H2>
      <P>
        Once the integration holds up against the mock, point it at a real network. Install the
        binding for your framework and wrap your app:
      </P>
      <CodeBlock language="bash">{`# React
npm install @partylayer/react
# Vue
npm install @partylayer/vue
# Vanilla / custom
npm install @partylayer/sdk`}</CodeBlock>
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectButton />
      <YourApp />
    </PartyLayerKit>
  );
}`}</CodeBlock>
      <P>
        Native CIP-0103 wallets injected at <Code>{'window.canton.*'}</Code> are auto-discovered at
        runtime, so any compliant wallet the user has installed appears in the picker with no adapter
        to write. For the full set of call signatures, the hooks based custom UI, and the Vanilla
        JavaScript path, see the <A href="/docs/quick-start">Quick Start</A> guide. For ready made
        recipes, see the <A href="/docs/cookbook">Pattern Cookbook</A>.
      </P>

      <H2 id="step-4-staging">Step 4: Staging and production</H2>
      <P>
        Moving from devnet to testnet to mainnet is a configuration change, not a code change. The
        network is selected by the <Code>{'network'}</Code> prop on <Code>{'PartyLayerKit'}</Code> (or
        the <Code>{'network'}</Code> field in <Code>{'createPartyLayer({ ... })'}</Code> for the SDK
        path):
      </P>
      <CodeBlock language="tsx">{`<PartyLayerKit network="mainnet" appName="My dApp">
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>
      <P>
        What changes between environments is which network the wallet connects to and which wallets
        support it. What does not change is your integration code: the same hooks, components, and call
        surface work across all three networks. Because wallet network support varies, check the
        per-wallet network support matrix, which lives in the project README and in the{' '}
        <A href="/docs/wallets">Wallets and Adapters</A> reference, to confirm the wallets you care
        about support your target network.
      </P>
      <P>
        One thing PartyLayer does not do at this step is move or vet your DAML packages. Where your
        DARs must live is a Canton topology question that is independent of which PartyLayer network
        you select. See{' '}
        <A href="/docs/partylayer-and-canton-topology">PartyLayer and Canton Topology</A> before you
        ship to staging if your dApp uses your own templates.
      </P>

      <H2 id="current-versions">Current versions</H2>
      <P>This guide targets the current release line:</P>
      <UL>
        <LI>
          <Strong><Code>{'@partylayer/react@2.0.0'}</Code></Strong>: TanStack Query v5 integration, the{' '}
          <Code>{'/query'}</Code> entrypoint with the query backed hooks and their Suspense twins.
        </LI>
        <LI>
          <Strong><Code>{'@partylayer/vue@1.0.0'}</Code></Strong>: the first stable Vue 3 release, with
          API parity to React.
        </LI>
        <LI>
          Both depend on <Code>{'@partylayer/core@0.10.0'}</Code>, which carries the CIP-0104 cost
          types.
        </LI>
      </UL>
      <P>
        If you are upgrading a React integration from the v1 line, see the{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/react-v2-migration.md">
          React v2 migration guide
        </A>.
      </P>

      <H2 id="see-also">See also</H2>
      <UL>
        <LI><A href="/docs/quick-start">Quick Start</A></LI>
        <LI><A href="/docs/cookbook">Pattern Cookbook</A></LI>
        <LI><A href="/docs/partylayer-and-canton-topology">PartyLayer and Canton Topology</A></LI>
        <LI>
          <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/react-v2-migration.md">
            React v2 migration guide
          </A>
        </LI>
      </UL>

      <PrevNext />
    </>
  );
}
