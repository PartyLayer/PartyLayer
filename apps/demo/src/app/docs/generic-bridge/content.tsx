'use client';

import { useDocs } from '../layout';

export default function GenericBridgeContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, OL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>Generic Bridge: Adapterless CIP-0103 Integration</H1>
      <P>
        PartyLayer connects dApps to Canton wallets. Historically each wallet needed its own
        first-party adapter. The generic bridge removes that: any wallet that implements CIP-0103
        and announces itself is picked up through a single code path, with no wallet-specific adapter
        package to write or maintain. New CIP-0103 wallets light up the moment they announce.
      </P>
      <P>This guide covers both sides:</P>
      <UL>
        <LI>For wallets: how to be discovered and driven by PartyLayer with zero adapter code.</LI>
        <LI>For dApps: how to connect to any CIP-0103 wallet through one API.</LI>
      </UL>
      <Callout type="note">
        A note on scope up front: the bridge normalizes the connection handshake and the call surface
        (one API mapped to each wallet&apos;s CIP-0103 methods). It does not rewrite a wallet&apos;s
        internal Daml-LF marshalling. If a wallet diverges from the spec inside its own prepare or
        submit path, that is still fixed on the wallet side.
      </Callout>

      <H2 id="announce-handshake">How it works: the announce handshake</H2>
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
        wallet&apos;s own channel, never a shared or last-one-wins slot. Because every call is scoped
        to that channel, a pick in the wallet list can only ever reach the wallet that announced it.
      </P>
      <P>
        A wallet that PartyLayer already ships a first-party adapter for (for example Console) is
        mapped to that adapter by id. Every other announcing CIP-0103 wallet is driven by the generic
        adapter described below, with no code on our side.
      </P>

      <H2 id="for-wallets">For wallets: be discovered with zero adapter code</H2>
      <P>
        To work through the generic bridge, a wallet implements the CIP-0103 dApp Standard and
        announces over <Code>{'canton:announceProvider'}</Code>. There is nothing PartyLayer-specific
        to build.
      </P>

      <H3 id="baseline">Required for the baseline</H3>
      <P>
        Announce over <Code>{'canton:announceProvider'}</Code>, and implement these CIP-0103 request
        methods:
      </P>
      <UL>
        <LI><Code>{'connect'}</Code>: establish the session and return the connected party.</LI>
        <LI><Code>{'signMessage'}</Code>: sign an arbitrary message.</LI>
        <LI><Code>{'prepareExecute'}</Code>: prepare and submit a transaction (this is what a transfer maps to).</LI>
      </UL>
      <P>
        With just these, the wallet exposes three capabilities through PartyLayer:{' '}
        <Code>{'connect'}</Code>, <Code>{'signMessage'}</Code>, and <Code>{'submitTransaction'}</Code>.
        That is a complete connect-and-transact surface, adapterless.
      </P>

      <H3 id="optional">Optional, additive</H3>
      <P>
        Each of these is feature-detected. Implement it and the matching capability turns on, leave it
        out and the baseline is unaffected.
      </P>
      <UL>
        <LI>
          <Code>{'ledgerApi'}</Code>: proxy Canton Ledger API reads and writes through the wallet.
          Enabling this adds the <Code>{'ledgerApi'}</Code> capability.
        </LI>
        <LI>
          <Code>{'status'}</Code> plus <Code>{'getPrimaryAccount'}</Code>: used for silent session
          restore on reload. Enabling these adds the <Code>{'restore'}</Code> capability.
        </LI>
        <LI>
          <Code>{'txChanged'}</Code> event: lets the dApp observe transaction status transitions.
          Enabling this adds the <Code>{'events'}</Code> capability.
        </LI>
      </UL>

      <H3 id="capability-mapping">Capability mapping reference</H3>
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

      <H3 id="registry-entry">Optional registry entry</H3>
      <P>
        A wallet works adapterless with no registry presence at all. A small registry entry is purely
        additive: it adds the wallet&apos;s name and icon to the picker and can opt the wallet into
        optional capabilities declaratively, still with no code.
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

      <H2 id="for-dapps">For dApps: connect to any CIP-0103 wallet</H2>
      <P>
        You write one API. The bridge maps it to whichever wallet the user picks, so you do not
        maintain a separate payload per wallet.
      </P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const pl = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});

// The picker lists every announcing CIP-0103 wallet, plus any first-party ones.
const session = await pl.connect();

// session.capabilitiesSnapshot reflects what the connected wallet actually
// supports, so feature-detect before relying on an optional capability.
if (session.capabilitiesSnapshot.includes('ledgerApi')) {
  // ledgerApi is available on this wallet
}`}</CodeBlock>
      <P>
        From the connected client you use the same <Code>{'connect'}</Code>, <Code>{'signMessage'}</Code>,{' '}
        <Code>{'submitTransaction'}</Code>, and <Code>{'ledgerApi'}</Code> calls no matter which wallet
        answered. See the <A href="/docs/quick-start">Quick Start</A> guide for the full call signatures.
      </P>
      <P>
        React projects can use the prebuilt <Code>{'ConnectButton'}</Code> and{' '}
        <Code>{'PartyLayerKit'}</Code>. Both list the same set of announced wallets automatically, and
        new CIP-0103 wallets appear in the picker as they ship, with no change to your app.
      </P>

      <H2 id="method-coverage">CIP-0103 method coverage</H2>
      <P>The bridge speaks the standard CIP-0103 surface. For reference, the methods and events it understands:</P>
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
        A wallet does not need all of these. The baseline three (<Code>{'connect'}</Code>,{' '}
        <Code>{'signMessage'}</Code>, <Code>{'prepareExecute'}</Code>) plus the announce are enough to be
        usable, the rest are additive.
      </P>

      <H2 id="scope">Scope and limits</H2>
      <P>
        The generic bridge gives a uniform, adapterless connect-and-transact surface across CIP-0103
        wallets, and grows wallet coverage without per-wallet code. What it standardizes is the payload
        shape and the call surface.
      </P>
      <P>
        What it does not do is change how a wallet marshals commands internally. If a wallet&apos;s own
        prepare or submit path diverges from the spec, for example decoding a <Code>{'TextMap'}</Code>{' '}
        choice context as a record, that is a wallet-side fix and is independent of the bridge. The
        bridge will deliver the correct, spec-shaped payload to the wallet either way.
      </P>

      <PrevNext />
    </>
  );
}
