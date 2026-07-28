'use client';

import { useDocs } from '../layout';

const GH = 'https://github.com/PartyLayer/PartyLayer/blob/main';

export default function GenericBridgeContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, OL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>Adapterless CIP-0103 integration: the two generic paths</H1>
      <P>
        PartyLayer connects dApps to Canton wallets. You do not need a PartyLayer-specific adapter
        package to be one of those wallets. There are exactly two generic paths, and every CIP-0103
        wallet fits one of them. Neither puts any wallet-specific code in the PartyLayer codebase.
      </P>
      <Callout type="tip">
        The sentence that matters most, stated once and plainly:{' '}
        <Strong>
          a wallet that already ships an adapter for the wider Canton ecosystem is done. Nothing
          PartyLayer-specific is required, only a registry entry.
        </Strong>{' '}
        If that describes you, skip to{' '}
        <A href="#path-b-discovery-adapter-remote-and-popup-wallets">Path B</A> for how the app hands
        your adapter to PartyLayer, and to <A href="#the-registry-entry">the registry entry</A> for
        the one piece of metadata to add.
      </Callout>
      <P>
        This guide is written for a wallet team we have never met. Read it once and you should know
        which path is yours, what to implement, what to put in the registry, and that you need nothing
        from us.
      </P>

      <H2 id="the-two-paths-and-how-to-tell-which-is-yours">The two paths, and how to tell which is yours</H2>
      <UL>
        <LI>
          <Strong>Path A, announce.</Strong> The wallet lives in the page: a browser extension that
          announces itself over <Code>{'canton:announceProvider'}</Code>. PartyLayer discovers it and
          drives it directly. No adapter object at all.
        </LI>
        <LI>
          <Strong>Path B, discovery adapter.</Strong> The wallet is a remote service or opens a popup,
          so it is not in the page to announce. The wallet ships its own adapter, an object satisfying
          the official <Code>{'ProviderAdapter'}</Code> shape, and the dApp hands that object to
          PartyLayer, which wraps it. This is the path for gateways, hosted wallets, and out-of-process
          desktop and mobile apps.
        </LI>
      </UL>
      <P>
        Decision guide:{' '}
        <Strong>
          if the wallet lives in the page, Path A; if it is a remote service or opens a popup, Path B.
        </Strong>
      </P>

      <H3 id="which-path-each-wallet-shape-takes">Which path each wallet shape takes</H3>
      <UL>
        <LI>
          <Strong>Browser extension</Strong> (Path A): it runs in the page, so it announces and
          PartyLayer drives it with no adapter object.
        </LI>
        <LI>
          <Strong>Remote or gateway service</Strong> (Path B): it is out of the page, so it ships an
          official adapter and the dApp supplies it. Its <Code>{'detect()'}</Code> returns{' '}
          <Code>{'true'}</Code> because a gateway is always reachable.
        </LI>
        <LI>
          <Strong>Mobile wallet (deep link)</Strong> (Path A or B): a deep link is how the wallet is
          opened, not a third path. If the wallet presents an in-page surface, Path A; if it is reached
          as a remote or gateway, Path B.
        </LI>
        <LI>
          <Strong>Desktop app</Strong> (usually Path B): typically reached as a local gateway or
          service, so Path B. Path A only if it injects into the page.
        </LI>
      </UL>
      <P>
        A deep link is an installation and launch detail, not an integration path. A mobile wallet still
        integrates through Path A or Path B like any other wallet; the deep link is simply how its
        adapter brings the wallet to the foreground.
      </P>

      <H3 id="a-checklist-a-wallet-team-can-work-through">A checklist a wallet team can work through</H3>
      <OL>
        <LI>Decide your shape from the list above. That fixes your path.</LI>
        <LI>
          Implement the CIP-0103 request methods you support. The baseline is <Code>{'connect'}</Code>,{' '}
          <Code>{'signMessage'}</Code>, and <Code>{'prepareExecute'}</Code>; the rest are additive. The
          exact request and result shape of every method is on the{' '}
          <A href="/docs/cip-0103#methods">CIP-0103 provider reference</A>.
        </LI>
        <LI>
          Path A: announce over <Code>{'canton:announceProvider'}</Code>. Path B: ship a small package
          that exports an object satisfying the official <Code>{'ProviderAdapter'}</Code> shape.
        </LI>
        <LI>
          Path B only: handle the remote concerns in{' '}
          <A href="#remote-and-gateway-wallets-the-recurring-questions">their own section</A>, namely
          popup policy, session survival, event streams, and origin validation.
        </LI>
        <LI>
          Add a registry entry, then open it as described in{' '}
          <A href="#submitting-your-registry-entry">Submitting your registry entry</A>. It is optional
          on Path A and expected on Path B, and it is metadata only, no code.
        </LI>
        <LI>
          Verify your adapter with the conformance runner, as described in{' '}
          <A href="#verifying-your-wallet">Verifying your wallet</A>. Connecting through a live dApp
          built on <Code>{'@partylayer/sdk'}</Code> is the manual second path.
        </LI>
        <LI>There is no step seven. Nothing is required from PartyLayer.</LI>
      </OL>

      <H2 id="path-a-announce-in-page-wallets">Path A: announce (in-page wallets)</H2>
      <P>Discovery follows the same pattern as EIP-6963 in Ethereum, adapted to Canton.</P>
      <OL>
        <LI>
          The dApp dispatches a <Code>{'canton:requestProvider'}</Code> event on <Code>{'window'}</Code>.
        </LI>
        <LI>
          Each installed wallet replies with a <Code>{'canton:announceProvider'}</Code> event carrying
          its metadata.
        </LI>
        <LI>
          PartyLayer collects the replies, deduplicates by stable id, and registers one adapter per
          wallet under the provider id <Code>{'browser:ext:<id>'}</Code>.
        </LI>
      </OL>
      <P>The announce payload is:</P>
      <CodeBlock language="typescript">{`interface AnnouncedWallet {
  id: string;       // stable provider id (the extension id)
  name?: string;    // display name shown in the wallet picker
  icon?: string;    // data: URI or URL
  target?: string;  // routing key for the extension postMessage channel
}`}</CodeBlock>
      <P>
        <Code>{'target'}</Code> is the channel the bridge talks to. When omitted it defaults to{' '}
        <Code>{'id'}</Code>, so an announce with no explicit target still routes to the announcing
        wallet&apos;s own channel, never a shared or last-one-wins slot. Because every call is scoped to
        that channel, a pick in the wallet list can only ever reach the wallet that announced it. The
        implementation is <Code>{'GenericAnnounceAdapter'}</Code> in{' '}
        <A href={`${GH}/packages/sdk/src/announce-adapter.ts`}>
          <Code>{'packages/sdk/src/announce-adapter.ts'}</Code>
        </A>
        .
      </P>
      <P>
        A wallet that PartyLayer already ships a first-party adapter for (for example Console) is mapped
        to that adapter by id. Every other announcing CIP-0103 wallet is driven by the generic announce
        adapter, with no code on our side.
      </P>

      <H3 id="what-a-path-a-wallet-implements">What a Path A wallet implements</H3>
      <P>
        Announce over <Code>{'canton:announceProvider'}</Code>, and implement these CIP-0103 request
        methods:
      </P>
      <UL>
        <LI><Code>{'connect'}</Code>: establish the session and return the connected party.</LI>
        <LI><Code>{'signMessage'}</Code>: sign an arbitrary message.</LI>
        <LI>
          <Code>{'prepareExecute'}</Code>: prepare and submit a transaction (this is what a transfer
          maps to).
        </LI>
      </UL>
      <P>
        With just these, the wallet exposes three capabilities through PartyLayer: <Code>{'connect'}</Code>,{' '}
        <Code>{'signMessage'}</Code>, and <Code>{'submitTransaction'}</Code>. That is a complete
        connect-and-transact surface, adapterless.
      </P>
      <P>
        Each of the following is feature-detected. Implement it and the matching capability turns on;
        leave it out and the baseline is unaffected.
      </P>
      <UL>
        <LI>
          <Code>{'ledgerApi'}</Code>: proxy Canton Ledger API reads and writes through the wallet. Adds
          the <Code>{'ledgerApi'}</Code> capability.
        </LI>
        <LI>
          <Code>{'status'}</Code> plus <Code>{'getPrimaryAccount'}</Code>: used for silent session
          restore on reload. Adds the <Code>{'restore'}</Code> capability.
        </LI>
        <LI>
          <Code>{'txChanged'}</Code> event: lets the dApp observe transaction status transitions. Adds
          the <Code>{'events'}</Code> capability.
        </LI>
      </UL>

      <H3 id="capability-mapping-reference">Capability mapping reference</H3>
      <P>How each PartyLayer capability maps to the CIP-0103 method or methods it calls:</P>
      <UL>
        <LI>
          <Strong><Code>{'connect'}</Code></Strong> calls <Code>{'connect'}</Code> (plus{' '}
          <Code>{'getPrimaryAccount'}</Code> and <Code>{'status'}</Code>). Baseline.
        </LI>
        <LI>
          <Strong><Code>{'signMessage'}</Code></Strong> calls <Code>{'signMessage'}</Code>. Baseline.
        </LI>
        <LI>
          <Strong><Code>{'submitTransaction'}</Code></Strong> calls <Code>{'prepareExecute'}</Code>. Baseline.
        </LI>
        <LI>
          <Strong><Code>{'ledgerApi'}</Code></Strong> calls <Code>{'ledgerApi'}</Code>. Optional.
        </LI>
        <LI>
          <Strong><Code>{'restore'}</Code></Strong> calls <Code>{'status'}</Code> and{' '}
          <Code>{'getPrimaryAccount'}</Code>. Optional.
        </LI>
        <LI>
          <Strong><Code>{'events'}</Code></Strong> uses <Code>{'txChanged'}</Code>. Optional.
        </LI>
      </UL>

      <H3 id="optional-registry-entry">Optional registry entry</H3>
      <P>
        A Path A wallet works with no registry presence at all. A small entry is additive: it adds the
        wallet&apos;s name and icon to the picker and can opt the wallet into optional capabilities
        declaratively, still with no code.
      </P>
      <CodeBlock language="json">{`{
  "name": "Your Wallet",
  "icon": "https://...",
  "capabilities": { "events": true },
  "adapter": { "transport": "announce" },
  "cip0103": { "native": true }
}`}</CodeBlock>
      <UL>
        <LI>
          <Code>{'adapter.transport: "announce"'}</Code> routes the entry through the generic announce path.
        </LI>
        <LI>
          <Code>{'cip0103.native: true'}</Code> is the canonical marker that the wallet speaks CIP-0103.
        </LI>
        <LI>
          <Code>{'capabilities'}</Code> and any <Code>{'adapter.config'}</Code> flags enable the optional
          surface above.
        </LI>
      </UL>

      <H2 id="path-b-discovery-adapter-remote-and-popup-wallets">Path B: discovery adapter (remote and popup wallets)</H2>
      <P>
        This is the path for a wallet that is not in the page to announce: a gateway, a hosted wallet, a
        popup, a desktop or mobile app reached out of process. It carries equal weight with Path A and is
        the right path for a large class of wallets.
      </P>

      <H3 id="what-the-wallet-ships">What the wallet ships</H3>
      <P>
        The wallet ships a small package that exports an object satisfying the official{' '}
        <Code>{'ProviderAdapter'}</Code> shape from <Code>{'@canton-network/core-wallet-discovery'}</Code>{' '}
        (current release 1.8.0). There is no PartyLayer-specific package. Any standards-compliant Canton
        adapter inherits this path, because PartyLayer matches the shape structurally rather than
        importing any <Code>{'@canton-network'}</Code> package. The generic host is{' '}
        <Code>{'GenericDiscoveryAdapter'}</Code> in{' '}
        <A href={`${GH}/packages/sdk/src/discovery-adapter.ts`}>
          <Code>{'packages/sdk/src/discovery-adapter.ts'}</Code>
        </A>
        ; it delegates every call to the provider your adapter returns.
      </P>

      <H3 id="the-provideradapter-members">The ProviderAdapter members</H3>
      <P>Taken from the official interface, with what each member is for:</P>
      <UL>
        <LI>
          <Code>{'providerId'}</Code>: stable id for the wallet. Aligns with the registry entry&apos;s{' '}
          <Code>{'id'}</Code>.
        </LI>
        <LI><Code>{'name'}</Code>, <Code>{'icon'}</Code>: display in the wallet picker.</LI>
        <LI>
          <Code>{'type'}</Code>: one of <Code>{'browser'}</Code>, <Code>{'desktop'}</Code>,{' '}
          <Code>{'mobile'}</Code>, <Code>{'remote'}</Code>.
        </LI>
        <LI>
          <Code>{'getInfo(): WalletInfo'}</Code>: wallet metadata for the picker, including capabilities
          and the popup-policy flag described <A href="#popup-policy">below</A>.
        </LI>
        <LI>
          <Code>{'detect(): Promise<boolean>'}</Code>: whether the wallet is currently available. A
          gateway always returns <Code>{'true'}</Code>; an extension probes for itself.
        </LI>
        <LI>
          <Code>{'provider(): Provider<DappRpcTypes>'}</Code>: returns the provider that carries the RPC.
          A remote adapter may return a provider that bridges the remote API to the dApp API surface. The
          caller invokes <Code>{"provider.request({ method: 'connect' })"}</Code> and, later,{' '}
          <Code>{'disconnect'}</Code>.
        </LI>
        <LI>
          <Code>{'teardown(): void'}</Code>: clean up adapter-specific resources, for example closing
          popup windows. Called after disconnect; it does not itself call disconnect on the provider.
        </LI>
        <LI>
          <Code>{'restore?(): Promise<Provider<DappRpcTypes> | null>'}</Code>: optional. Attempt to
          reinstate a previous session, returning a ready-to-use provider or <Code>{'null'}</Code>. See{' '}
          <A href="#session-survival">session survival</A> for how PartyLayer&apos;s bridge treats this.
        </LI>
      </UL>

      <H3 id="the-provider-shape-which-is-the-crux">The provider shape, which is the crux</H3>
      <P><Code>{'Provider'}</Code> has exactly four members:</P>
      <UL>
        <LI><Code>{'request(args)'}</Code>: the one you write. It dispatches an RPC call to the wallet.</LI>
        <LI>
          <Code>{'on(event, listener)'}</Code>, <Code>{'emit(event, ...args)'}</Code>,{' '}
          <Code>{'removeListener(event, listener)'}</Code>: event handling.
        </LI>
      </UL>
      <P>
        The official provider package ships an <Code>{'AbstractProvider'}</Code> base class that
        implements the three event methods, so an implementer writes only <Code>{'request'}</Code>. A
        minimal remote adapter is therefore short:
      </P>
      <CodeBlock language="typescript">{`import { AbstractProvider } from '@canton-network/core-splice-provider';
import type { ProviderAdapter } from '@canton-network/core-wallet-discovery';
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client';
import type { RequestArgs } from '@canton-network/core-types';

// Only request() is yours. on/emit/removeListener come from AbstractProvider.
class WalletXProvider extends AbstractProvider<DappRpcTypes> {
  async request<M extends keyof DappRpcTypes>(
    args: RequestArgs<DappRpcTypes, M>,
  ): Promise<DappRpcTypes[M]['result']> {
    // Dispatch args to the wallet's own RPC (gateway call, popup postMessage, ...)
    // and return the CIP-0103 result. Reaching the gateway, opening and validating the
    // popup, and persisting the session are the wallet's business, not PartyLayer's.
    throw new Error('send args to your wallet transport and return its result');
  }
}

// The object the wallet ships and the app hands to PartyLayer.
export const walletXAdapter: ProviderAdapter = {
  providerId: 'walletx',
  name: 'Wallet X',
  type: 'remote',
  icon: 'https://walletx.example/icon.svg',
  getInfo() {
    return { providerId: 'walletx', name: 'Wallet X', type: 'remote' };
  },
  detect() {
    return Promise.resolve(true); // a gateway is always reachable
  },
  provider() {
    return new WalletXProvider();
  },
  teardown() {
    // close the popup window this adapter opened
  },
  restore() {
    return Promise.resolve(null); // reinstate a saved session, or null
  },
};`}</CodeBlock>
      <P>
        The four imports resolve against the published <Code>{'@canton-network'}</Code> packages
        (<Code>{'core-splice-provider'}</Code>, <Code>{'core-wallet-discovery'}</Code>,{' '}
        <Code>{'core-wallet-dapp-rpc-client'}</Code>, and <Code>{'core-types'}</Code>);{' '}
        <Code>{'DappRpcTypes'}</Code> is the <Code>{'RpcTypes'}</Code> request-and-result map re-exported
        under that name. Copy the block into a <Code>{'.ts'}</Code> file and it typechecks as is.
      </P>
      <P>
        Everything inside <Code>{'request'}</Code>, and how the adapter reaches its gateway, opens and
        validates its popup, and persists a session, is the wallet&apos;s own business. PartyLayer only
        ever calls <Code>{'request(args)'}</Code>.
      </P>

      <H3 id="how-the-dapp-wires-it">How the dApp wires it</H3>
      <P>
        The dApp passes your adapter instance in the SDK config. The SDK detects the official shape and
        wraps it through the generic discovery bridge automatically:
      </P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';
import { walletXAdapter } from '@walletx/dapp-sdk';

const pl = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  adapters: [walletXAdapter], // wrapped by the generic discovery bridge
});`}</CodeBlock>
      <P>
        There are two supply forms. An instance with a host baked in at construction is used as is. A
        factory form, <Code>{'create(host)'}</Code>, lets the SDK build the adapter with the host resolved
        from the registry entry&apos;s <Code>{'adapter.networkHosts'}</Code> for the active network, which
        is how a single registry entry serves devnet, testnet, and mainnet.
      </P>

      <H3 id="the-registry-entry">The registry entry</H3>
      <P>
        For a discovery-adapter wallet the registry entry is expected, because it tells the dApp which
        package to load and which host to use per network. Walley is the live example in the stable
        registry (shown here as an example, not as the subject of this guide):
      </P>
      <CodeBlock language="json">{`{
  "id": "walley",
  "name": "Walley",
  "adapter": {
    "type": "@k2flabs/walley-dapp-sdk",
    "transport": "discovery-adapter",
    "config": { "providerId": "walley" },
    "networkHosts": {
      "devnet": "https://dev.walley.cc",
      "testnet": "https://staging.walley.cc",
      "mainnet": "https://walley.cc"
    }
  },
  "cip0103": { "native": true }
}`}</CodeBlock>
      <UL>
        <LI>
          <Code>{'adapter.type'}</Code> names the wallet&apos;s own published package, not a PartyLayer
          package.
        </LI>
        <LI>
          <Code>{'adapter.transport: "discovery-adapter"'}</Code> routes the entry through the generic host.
        </LI>
        <LI>
          <Code>{'adapter.networkHosts'}</Code> supplies the per-network host for the factory form.
        </LI>
      </UL>
      <P>
        Walley&apos;s registry description states, in as many words, that there is no PartyLayer-specific
        adapter package: it is bridged through its own <Code>{'@k2flabs/walley-dapp-sdk'}</Code> adapter.
        That package (published at 1.1.0) depends on the official discovery and provider packages,{' '}
        <Code>{'@canton-network/core-wallet-discovery'}</Code> and{' '}
        <Code>{'@canton-network/core-splice-provider'}</Code>, and nothing from PartyLayer.
      </P>

      <H2 id="remote-and-gateway-wallets-the-recurring-questions">Remote and gateway wallets: the recurring questions</H2>
      <P>
        Path B wallets share a set of concerns that in-page wallets do not. They are answered factually
        here so a wallet team does not have to ask.
      </P>

      <H3 id="session-survival">Session survival</H3>
      <P>
        A page reload tears down the provider. The official <Code>{'ProviderAdapter.restore'}</Code>{' '}
        member exists for this: a wallet reinstates a previous session, for example from{' '}
        <Code>{'localStorage'}</Code>, and returns a ready-to-use provider or <Code>{'null'}</Code>.
      </P>
      <P>
        PartyLayer&apos;s generic discovery bridge calls your <Code>{'restore'}</Code> on reload. The SDK
        revives its persisted session record, validates it against the configured network, then asks the
        official adapter to restore; when <Code>{'restore'}</Code> returns a live provider the bridge
        adopts it, so the first request after the reload uses the restored session and succeeds. So put
        your restoration logic in <Code>{'restore'}</Code>, as the official interface intends: read your
        session from your own storage and return the live provider.
      </P>
      <P>
        One constraint: <Code>{'restore'}</Code> runs on the reload path, outside any user gesture, so
        keep it gesture-free, a storage read rather than a popup. If a wallet genuinely needs a fresh
        interaction to reconnect, it falls back to a fresh connect.
      </P>
      <P>
        A wallet whose official adapter has no <Code>{'restore'}</Code> revives as-is: the app shows it as
        connected, but the first real request throws until the user reconnects. Implementing{' '}
        <Code>{'restore'}</Code> is what closes that gap.
      </P>

      <H3 id="popup-policy">Popup policy</H3>
      <P>
        A wallet declares <Code>{'reuseGlobalWalletPopup'}</Code> on its <Code>{'WalletInfo'}</Code>. When
        set, the wallet picker keeps its global popup open after the user picks, so the wallet can reuse
        it for asynchronous navigations. The documented case for this is an HTTP wallet gateway; it is not
        used for synchronous dApp-API wallets even when <Code>{'type'}</Code> is <Code>{'remote'}</Code>.
      </P>
      <P>
        The practical constraint is the browser&apos;s user-gesture requirement: a popup opens only from
        the synchronous call stack of a user action. PartyLayer&apos;s connect path is built to reach the
        wallet&apos;s <Code>{'provider()'}</Code> and the popup with no awaits in front of it, so the popup
        survives the gesture. Your adapter must not insert an <Code>{'await'}</Code> before it opens the
        popup, or the browser will block it.
      </P>

      <H3 id="event-streams">Event streams</H3>
      <P>
        Remote wallets often deliver status over a stream. If the server does not attach event ids, a
        client cannot resume with <Code>{'Last-Event-ID'}</Code> after a dropped connection, because there
        is no cursor to resume from. The correct behavior is to re-read state after a reconnect rather
        than assume the stream continued uninterrupted. PartyLayer&apos;s discovery bridge does not depend
        on a wallet emitting events at all; it never reports the <Code>{'events'}</Code> capability for a
        discovery-adapter wallet, and it re-probes state rather than trusting continuity.
      </P>

      <H3 id="origin-validation">Origin validation</H3>
      <P>
        A popup that returns its result to the opener by <Code>{'postMessage'}</Code> must validate both
        the event <Code>{'origin'}</Code> and the <Code>{'source'}</Code> window before trusting the
        message. Validate <Code>{'origin'}</Code> against the exact expected wallet origin, and confirm{' '}
        <Code>{'source'}</Code> is the popup window the adapter opened. This belongs in the wallet&apos;s
        adapter, because that is where the popup is opened and where the expected origin and window
        reference are known. Getting it wrong is not cosmetic: any window that can post to the opener,
        including an unrelated page or a malicious frame, could otherwise supply a forged result and the
        opener would accept it as the wallet&apos;s answer.
      </P>

      <H2 id="verifying-your-wallet">Verifying your wallet</H2>
      <P>
        Before you ship, check your work against the published conformance runner,{' '}
        <A href="https://www.npmjs.com/package/@partylayer/conformance-runner">
          <Code>{'@partylayer/conformance-runner'}</Code>
        </A>
        , a CLI that validates an adapter against the CIP-0103 surface: it loads your adapter, runs the
        suite, writes a JSON report, prints a summary, and exits non-zero on any failure, so it drops
        straight into CI.
      </P>
      <CodeBlock language="bash">{`npm install -g @partylayer/conformance-runner

# Validate an adapter package or a built path against the CIP-0103 surface.
partylayer-conformance run --adapter <package-name-or-path>

# Run the CIP-0103 provider suite.
partylayer-conformance run-cip0103

# Full flag list.
partylayer-conformance --help`}</CodeBlock>
      <P>
        <Code>{'run'}</Code> takes <Code>{'--adapter'}</Code> (an npm package name or a path to your
        built adapter) and an optional <Code>{'--network'}</Code> (default <Code>{'devnet'}</Code>), and
        writes <Code>{'conformance-report.json'}</Code>. Point it at your Path B discovery adapter, or at
        any adapter package you build.
      </P>
      <P>
        The manual second path, and the only one for an adapterless Path A wallet, is to connect through
        a live dApp built on <Code>{'@partylayer/sdk'}</Code> (or the prebuilt{' '}
        <Code>{'ConnectButton'}</Code>) and exercise connect, sign, and submit by hand. The runner is
        faster and repeatable; the manual path is the real-world confirmation.
      </P>

      <H2 id="submitting-your-registry-entry">Submitting your registry entry</H2>
      <P>
        You add a registry entry five times over in this guide; here is how you actually get it in. The
        registry is a signed JSON file the SDK fetches from{' '}
        <Code>{'https://registry.partylayer.xyz'}</Code>, one file per channel:{' '}
        <Code>{'registry/v1/beta/registry.json'}</Code> and{' '}
        <Code>{'registry/v1/stable/registry.json'}</Code> in this repository. Your wallet is one entry in
        the <Code>{'wallets'}</Code> array.
      </P>
      <P>
        New wallets land in <Strong>beta</Strong> first and are promoted to <Strong>stable</Strong> after
        a soak. Beta is what a dApp opts into for early testing; stable is the default channel every dApp
        sees.
      </P>
      <P>To get listed:</P>
      <OL>
        <LI>
          Build your entry against the schema in the{' '}
          <A href={`${GH}/docs/registry-onboarding.md`}>registry onboarding guide</A>, which is the
          authoritative field list. The snippets in this guide show only the transport and{' '}
          <Code>{'cip0103'}</Code> fields; the full entry also requires <Code>{'supportedNetworks'}</Code>{' '}
          and the <Code>{'capabilities'}</Code> booleans.
        </LI>
        <LI>
          Open a pull request adding it to <Code>{'registry/v1/beta/registry.json'}</Code>. The gate
          (<Code>{'pnpm gate:registry'}</Code>) validates your entry against the schema on the pull
          request, so you get immediate feedback. You do not need our signing keys: a maintainer signs the
          channel after review.
        </LI>
        <LI>
          A maintainer reviews the entry (schema, truthful capabilities, and the <Code>{'cip0103'}</Code>{' '}
          evidence), signs the beta registry, and it publishes to the CDN at{' '}
          <Code>{'https://registry.partylayer.xyz'}</Code>, where the SDK picks it up by channel. After
          the beta soak we promote it to stable.
        </LI>
      </OL>
      <P>
        If you would rather not open a pull request, open a{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/issues">GitHub issue</A> with your entry and a
        maintainer will add it. The <A href={`${GH}/docs/registry-ops.md`}>registry operations guide</A>{' '}
        documents the signing, promotion, and CDN mechanics on our side; you do not run those steps.
      </P>

      <H2 id="cip-0103-method-coverage">CIP-0103 method coverage</H2>
      <P>
        The bridge speaks the standard CIP-0103 surface, and it is <Strong>identical on both paths</Strong>.
        A wallet implements CIP-0103 once; whether PartyLayer reaches it by announce or by discovery
        adapter does not change the method set.
      </P>
      <UL>
        <LI>
          Requests: <Code>{'connect'}</Code>, <Code>{'disconnect'}</Code>, <Code>{'isConnected'}</Code>,{' '}
          <Code>{'status'}</Code>, <Code>{'getActiveNetwork'}</Code>, <Code>{'listAccounts'}</Code>,{' '}
          <Code>{'getPrimaryAccount'}</Code>, <Code>{'signMessage'}</Code>, <Code>{'prepareExecute'}</Code>,{' '}
          <Code>{'ledgerApi'}</Code>.
        </LI>
        <LI>
          Events: <Code>{'statusChanged'}</Code>, <Code>{'accountsChanged'}</Code>,{' '}
          <Code>{'txChanged'}</Code>, <Code>{'connected'}</Code>.
        </LI>
      </UL>
      <P>
        A wallet does not need all of these. The baseline three, <Code>{'connect'}</Code>,{' '}
        <Code>{'signMessage'}</Code>, and <Code>{'prepareExecute'}</Code>, are enough to be usable; the
        rest are additive. The <A href="/docs/cip-0103">CIP-0103 provider reference</A> gives the exact
        request and result shape of every method and event.
      </P>

      <H2 id="a-note-on-the-five-wallets-with-a-partylayer-specific-adapter">
        A note on the five wallets with a PartyLayer-specific adapter
      </H2>
      <P>
        The stable registry today has eight wallets: two on announce (Console, Send), one on the discovery
        adapter (Walley), and five with no declared transport that still ship a PartyLayer-specific adapter
        package (5N Loop, Cantor8, Bron, Nightly, WalletConnect).
      </P>
      <P>
        Read plainly, that list could suggest that writing a PartyLayer-specific package is the expected
        route. It is not, and reading it that way has already cost an external contributor real work. Those
        five predate the generic paths and exist for historical reasons. New wallets should not follow that
        pattern: they should use Path A or Path B and ship no PartyLayer-specific code.
      </P>
      <P>
        A wallet already shipping a PartyLayer-specific adapter can move to a generic path. In practice that
        means announcing over <Code>{'canton:announceProvider'}</Code> (Path A) or shipping an official{' '}
        <Code>{'ProviderAdapter'}</Code> and switching its registry entry to{' '}
        <Code>{'adapter.transport: "discovery-adapter"'}</Code> with the package under{' '}
        <Code>{'adapter.type'}</Code> (Path B), after which the PartyLayer-specific package is no longer
        needed.
      </P>

      <H2 id="scope-and-limits">Scope and limits</H2>
      <P>
        The generic bridge normalizes the connection handshake and the call surface: one API mapped to each
        wallet&apos;s CIP-0103 methods, on either path, with no per-wallet code.
      </P>
      <P>
        What neither path does is change how a wallet marshals commands internally. If a wallet&apos;s own
        prepare or submit path diverges from the spec, for example decoding a <Code>{'TextMap'}</Code>{' '}
        choice context as a record, that is a wallet-side fix and is independent of the bridge. The bridge
        delivers the correct, spec-shaped payload to the wallet either way.
      </P>
      <P>
        Neither path invents capabilities a wallet does not have. Capabilities are feature-detected and
        reported truthfully, so a dApp checks <Code>{'session.capabilitiesSnapshot'}</Code> before relying
        on an optional one. The discovery bridge in particular never reports <Code>{'events'}</Code>,
        because popup and remote wallets expose the event surface but do not emit.
      </P>

      <H2 id="how-ethereum-settled-the-same-shape">How Ethereum settled the same shape</H2>
      <P>
        The same two-path shape is where Ethereum&apos;s ecosystem landed, which is worth one paragraph as
        context. In-page wallets are discovered through EIP-6963 and driven by a single injected connector,
        the direct analogue of Path A. Remote wallets go through one shared protocol rather than a package
        per wallet, the analogue of Path B. RainbowKit additionally ships a generic fallback entry so that
        a remote wallet absent from its curated list still works, which is the idea proposed below.
      </P>

      <H2 id="choosing-a-path">Choosing a path</H2>
      <P>
        If the wallet lives in the page, Path A: announce, implement the baseline CIP-0103 methods, and
        optionally add a registry entry. If the wallet is a remote service or opens a popup, Path B: ship an
        official <Code>{'ProviderAdapter'}</Code>, let the dApp supply it, and add a registry entry with{' '}
        <Code>{'transport: "discovery-adapter"'}</Code>.
      </P>
      <P>
        And once more, because it is the point of this document:{' '}
        <Strong>
          a wallet that already ships an adapter for the wider Canton ecosystem is done. Nothing
          PartyLayer-specific is required, only a registry entry.
        </Strong>
      </P>

      <H2 id="proposal-not-shipped-a-generic-fallback-picker-entry">
        Proposal, not shipped: a generic fallback picker entry
      </H2>
      <Callout type="note">This section is a proposal, not a current feature.</Callout>
      <P>
        Following RainbowKit&apos;s generic fallback, PartyLayer could show a single generic entry in the
        wallet picker for any wallet that supplies an official <Code>{'ProviderAdapter'}</Code> but is
        absent from our registry. A user with such a wallet could then connect without waiting for a
        registry entry to land.
      </P>
      <P>
        What it would take: a picker entry that accepts an app-supplied official adapter with no matching
        registry <Code>{'id'}</Code>, resolves its host from the adapter rather than from{' '}
        <Code>{'networkHosts'}</Code>, and labels the entry generically. It is not implemented today, and
        this document does not claim otherwise. A discovery-adapter wallet is surfaced today through its
        registry entry, as <A href="#the-registry-entry">above</A>.
      </P>

      <PrevNext />
    </>
  );
}
