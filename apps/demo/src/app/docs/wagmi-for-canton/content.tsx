'use client';

import { useDocs } from '../layout';

export default function WagmiForCantonPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>wagmi for Canton developers</H1>
      <P>
        If you have built an EVM frontend, you already know most of the shape of a Canton one. This
        page maps what you know onto what PartyLayer gives you, and then spends most of its length on
        the places where the analogy stops working, because those are the ones that cost time.
      </P>

      <Callout type="note">
        <Strong>Sources and versions.</Strong> wagmi hook names were read from{' '}
        <A href="https://wagmi.sh/react/api/hooks">wagmi&apos;s own hook reference</A> at version{' '}
        <Code>{'3.7.7'}</Code>. PartyLayer hook names come from this SDK. Both matter, because wagmi
        renamed several hooks in v3 and a mapping written from memory would be wrong on the most
        familiar one: <Code>{'useAccount'}</Code> no longer exists in wagmi. It is{' '}
        <Code>{'useConnection'}</Code> now.
      </Callout>

      <H2 id="the-joke">The first thing that will confuse you</H2>
      <P>
        PartyLayer has a hook called <Code>{'useAccount'}</Code>. wagmi does not, any more. If you
        arrive from wagmi v3 expecting <Code>{'useConnection'}</Code> and reach for the name you used
        in v2, you will find it here and it will work, which is more disorienting than if it were
        missing. Ours reports the connected party, not an EVM address.
      </P>

      <H2 id="mapping">What maps cleanly</H2>
      <P>Connection and signing are close enough that porting is mechanical.</P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid rgba(15,23,42,0.10)' }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>wagmi 3.7.7</th>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>PartyLayer</th>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['WagmiProvider + createConfig', 'PartyLayerKit', 'One provider at the root. Adapters replace connectors.'],
              ['useConnection', 'useAccount', 'Reports the connected party id, not an address.'],
              ['useConnect', 'useConnect', 'Same shape. Takes a wallet id rather than a connector.'],
              ['useDisconnect', 'useDisconnect', 'Same.'],
              ['useConnectors', 'useWallets', 'Registry-backed rather than statically configured.'],
              ['useSignMessage', 'useSignMessage', 'Same intent. Check the base64 note below.'],
              ['useSendTransaction', 'useSubmitTransaction', 'Submits Daml commands, not calldata.'],
              ['useWaitForTransactionReceipt', 'submit result', 'Awaited in the submit call, not a separate hook.'],
              ['ConnectButton (RainbowKit)', 'ConnectButton', 'Drop-in, themeable. See Theming.'],
            ].map(([w, p, n]) => (
              <tr key={w}>
                <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}>{w}</td>
                <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}>{p}</td>
                <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>Side by side, the connect flow you already know:</P>
      <CodeBlock language="typescript">{`// wagmi 3.x
import { WagmiProvider, createConfig, http } from 'wagmi';
import { useConnection, useConnect } from 'wagmi';

// PartyLayer
import { PartyLayerKit, ConnectButton, useAccount, useConnect } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet">
      <Profile />
      <ConnectButton />
    </PartyLayerKit>
  );
}

function Profile() {
  const { partyId, isConnected } = useAccount();
  if (!isConnected) return null;
  return <span>{partyId}</span>;
}`}</CodeBlock>

      <H2 id="breaks">Where the analogy breaks</H2>
      <P>
        These are not gaps waiting to be filled. They follow from Canton being privacy-first and
        contract-based rather than account-and-storage based, so a hook that papers over them would be
        lying.
      </P>

      <H3>1. There is no useReadContract, because there is no public state</H3>
      <P>
        This is the big one. On an EVM chain any client can read any storage slot, which is what makes{' '}
        <Code>{'useReadContract'}</Code> possible without a wallet. On Canton you can only read
        contracts you are a witness to, and what you are a witness to depends on which party you are.
        There is no global state to query.
      </P>
      <P>
        So reads are party-scoped and require a connection. <Code>{'useTokenHoldings'}</Code>,{' '}
        <Code>{'useDamlContract'}</Code> and <Code>{'useLedgerApi'}</Code> all read as the connected
        party, and a different party running the same code legitimately sees different results.{' '}
        <A href="/docs/privacy-and-reads">Privacy and reads</A> covers how visibility actually works.
      </P>
      <P>
        <Strong>Practical consequence:</Strong> a landing page that shows chain data before the user
        connects has no Canton equivalent. Design for connect-first.
      </P>

      <H3>2. No ABI. Templates and choices instead</H3>
      <P>
        There is no ABI to import and no function selector. A Daml contract is a template instance,
        and you act on it by exercising a named choice. <Code>{'useChoice'}</Code> is the closest
        thing to <Code>{'useWriteContract'}</Code>, and the shape it takes is a command, not an
        encoded call.
      </P>

      <H3>3. Contracts are archived and recreated, not mutated</H3>
      <P>
        Exercising a choice typically archives the current contract and creates a successor. There is
        no in-place update, so a contract id is not a stable handle across a state change the way an
        EVM address is. Code that caches a contract id and reuses it after a write will be holding a
        reference to an archived contract.
      </P>

      <H3>4. useSwitchChain has no working equivalent</H3>
      <P>
        Not a design position on our side, a fact about the ecosystem today:{' '}
        <Strong>every wallet in the registry declares switchNetwork: false</Strong>, all ten of them.
        You can see it in the capability matrix on the{' '}
        <A href="/wallets">Canton wallet directory</A>, which is generated from the registry, so if
        that changes the page changes.
      </P>
      <P>
        Configure the network on <Code>{'PartyLayerKit'}</Code> and treat it as fixed for the session.
        A multi-network app mounts per network rather than switching in place.
      </P>

      <H3>5. Gas is traffic, and it is priced differently</H3>
      <P>
        There is no gas price to estimate and no priority fee to bid. Canton charges for traffic, and
        the cost of a submission can be read before you submit it rather than estimated. See{' '}
        <A href="/docs/performance">Performance</A> for the measured side, and the cost hooks for
        pre-submission estimates. Nothing here corresponds to{' '}
        <Code>{'useEstimateFeesPerGas'}</Code>.
      </P>

      <H3>6. A party id is not an address</H3>
      <P>
        An EVM address is derived from a keypair, so anyone can compute one offline and it is
        self-certifying. A Canton party id is allocated on a participant node and carries a namespace.
        You cannot derive it from a public key alone, and two parties can be backed by the same key
        material. Treat it as an identifier issued to the user, not as a hash of their key.
      </P>

      <H3>7. Some transactions need more than one signature</H3>
      <P>
        A Daml choice can require several signatories, which has no EVM single-signer equivalent and
        is not a multisig contract pattern either: it is in the model. If your app coordinates two
        parties, read <A href="/docs/multi-party-patterns">Multi-party patterns</A> before designing
        the flow, because retrofitting it is expensive.
      </P>

      <Callout type="warning">
        <Strong>One porting trap worth naming.</Strong> Console Wallet base64-encodes a message&apos;s
        UTF-8 bytes before signing, recorded in its registry entry as{' '}
        <Code>{'signMessageBase64: true'}</Code>. If you verify a signature against raw bytes the way
        you would with <Code>{'personal_sign'}</Code>, it will not match. Per-wallet notes are on the{' '}
        <A href="/wallets">wallet directory</A>.
      </Callout>

      <H2 id="what-to-do">If you are porting an app</H2>
      <UL>
        <LI>
          Start from <A href="/docs/quick-start">Quick Start</A>. The connect layer is the part that
          ports mechanically, so get it working first and it will feel familiar.
        </LI>
        <LI>
          Then find every read in your app that runs before connect. Those are the ones that need
          rethinking, and there are usually more than you expect.
        </LI>
        <LI>
          Replace ABI-and-selector thinking with template-and-choice thinking before you write the
          write path. <A href="/docs/token-transfers">Token transfers</A> is a worked example.
        </LI>
        <LI>
          Check the <A href="/wallets">wallet directory</A> for what your target wallets actually
          support through their adapters. Capability flags there map to specific hooks, and several
          wallets do not implement signing at all.
        </LI>
      </UL>

      <PrevNext />
    </>
  );
}
