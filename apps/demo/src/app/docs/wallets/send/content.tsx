'use client';

import { useDocs } from '../../layout';

export default function SendContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, A, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>Send Wallet (Beta)</H1>

      <Callout type="warning">
        <Strong>Beta:</Strong> Send Foundation has indicated that production use is not yet
        recommended. The adapter is published as <Code>{'@partylayer/adapter-send@0.1.0'}</Code> on the
        beta channel and is feature-complete for connect, sign, submit, and ledger-API flows on
        Canton <Code>{'mainnet'}</Code>.
      </Callout>

      <P>
        <Strong>Send</Strong> is a passkey-based Canton wallet built by Send Foundation. The wallet is
        delivered as a Chrome extension that injects a <Code>{'window.canton'}</Code> provider following
        the splice-wallet-kernel OpenRPC contract. The dApp connection layer is open-sourced as{' '}
        <A href="https://sigilry.org">Sigilry</A>; the
        PartyLayer adapter wraps that contract with the same surface every other Canton wallet uses.
      </P>

      <H2 id="how-send-differs">How Send Differs</H2>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 14,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Property', 'Send', 'Notes'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { prop: 'Authentication', send: 'Passkey (WebAuthn-PRF)', note: 'Touch ID / Face ID prompt per signature' },
              { prop: 'Provider injection', send: 'window.canton', note: 'CIP-0103 / splice-wallet-kernel native via Sigilry' },
              { prop: 'Networks', send: 'canton:mainnet only', note: 'DevNet support pending Send Foundation' },
              { prop: 'Channel', send: 'beta', note: 'Per Send Foundation guidance' },
              { prop: 'Identification', send: 'kernel.id = ldmohiccoioolenadmogclhoklmanpgi', note: 'Chrome Web Store extension ID; globally unique' },
            ].map(r => (
              <tr key={r.prop} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0B0F1A' }}>{r.prop}</td>
                <td style={{ padding: '10px 14px', color: '#0B0F1A', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5 }}>{r.send}</td>
                <td style={{ padding: '10px 14px', color: '#64748B' }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="installation">Installation</H2>
      <P>
        Send requires the user to have the Send extension installed in Chrome. Direct your users to
        the{' '}
        <A href="https://chromewebstore.google.com/detail/send/ldmohiccoioolenadmogclhoklmanpgi">
          Chrome Web Store listing
        </A>{' '}
        before they can connect.
      </P>
      <CodeBlock language="bash">{`npm install @partylayer/sdk @partylayer/react @partylayer/adapter-send`}</CodeBlock>
      <P>
        With <Code>{'PartyLayerKit'}</Code>{' '}auto-discovery there is no further wiring — Send appears
        in the wallet picker automatically. If you build a custom adapter set, register{' '}
        <Code>{'SendAdapter'}</Code> alongside the others:
      </P>
      <CodeBlock language="tsx">{`import { createPartyLayer, getBuiltinAdapters, SendAdapter } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  appName: 'My dApp',
  adapters: [...getBuiltinAdapters(), new SendAdapter()],
});`}</CodeBlock>
      <Callout type="note">
        Send is <Strong>already in <Code>{'getBuiltinAdapters()'}</Code></Strong>. The example above is
        only meaningful if you previously passed a manually-curated adapter list.
      </Callout>

      <H2 id="connection-flow">Connection Flow</H2>
      <CodeBlock language="tsx">{`import { useConnect } from '@partylayer/react';

function ConnectWithSend() {
  const { connect, isConnecting } = useConnect();
  return (
    <button
      onClick={() => connect('send')}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting…' : 'Connect with Send'}
    </button>
  );
}`}</CodeBlock>
      <P>End-to-end user experience:</P>
      <UL>
        <LI>User clicks <Strong>Connect with Send</Strong>.</LI>
        <LI>Send extension shows its{' '}<Strong>Connect to Site?</Strong>{' '}permission prompt.</LI>
        <LI>On approval, the OS surfaces a{' '}<Strong>passkey prompt</Strong> (Touch ID / Face ID).</LI>
        <LI>Once unlocked, the SDK receives a session containing <Code>{'partyId'}</Code>,{' '}
          <Code>{'kernelId'}</Code>, and the wallet{"'"}s public key.</LI>
      </UL>
      <Callout type="note">
        Every signature operation (<Code>{'signMessage'}</Code>, <Code>{'submitTransaction'}</Code>) prompts
        a fresh passkey unlock — this is by design. Send does not cache passkey approval across calls.
      </Callout>

      <H2 id="reading-the-ledger">Reading the Ledger</H2>
      <P>
        Send proxies the Canton v2 JSON Ledger API through Sigilry{"'"}s <Code>{'ledgerApi'}</Code> RPC
        method. Use <Code>{'useLedgerApi'}</Code> for any read-side query:
      </P>
      <CodeBlock language="tsx">{`import { useLedgerApi } from '@partylayer/react';

function LedgerEndDisplay() {
  const { ledgerApi } = useLedgerApi();
  const [offset, setOffset] = useState<string | null>(null);

  useEffect(() => {
    ledgerApi({
      requestMethod: 'GET',
      resource: '/v2/state/ledger-end',
    }).then(({ response }) => {
      const parsed = JSON.parse(response) as { offset: string };
      setOffset(parsed.offset);
    });
  }, [ledgerApi]);

  return <div>Ledger end: {offset ?? 'loading…'}</div>;
}`}</CodeBlock>
      <P>
        For active-contracts queries with <Code>{'eventFormat'}</Code>, see the{' '}
        <A href="/docs/wallet-balances">Wallet Balances</A> guide — Send accepts the same
        request shape as the other ledger-API-capable adapters.
      </P>

      <H2 id="token-transfers">Token Standard Transfers (CIP-56)</H2>
      <P>
        Send signs and submits transactions in a single step via{' '}
        <Code>{'prepareExecuteAndWait'}</Code>. The wallet handles Scan-side coordination, choice
        context lookup, and passkey signing internally. Adapter consumers call{' '}
        <Code>{'submitTransaction'}</Code> with a <Code>{'JsPrepareSubmissionRequest'}</Code>:
      </P>
      <CodeBlock language="tsx">{`import { useSubmitTransaction } from '@partylayer/react';

const { submit } = useSubmitTransaction();

await submit({
  signedTx: {
    commandId: crypto.randomUUID(),
    commands: [
      {
        ExerciseCommand: {
          templateId:
            '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory',
          contractId: factoryCid,
          choice: 'TransferFactory_Transfer',
          choiceArgument: { /* …Scan-derived shape… */ },
        },
      },
    ],
    actAs: [session.partyId],
  },
});`}</CodeBlock>
      <P>
        See <A href="/docs/token-transfers">Token Transfers</A> for the full CIP-56 flow including the
        Scan <Code>{'/registry/transfer-instruction/v1/transfer-factory'}</Code> endpoint and the
        choice-context tagged-union shape.
      </P>
      <Callout type="warning">
        The Send adapter ships the same <Strong>templateId migration warning</Strong> as Loop —
        passing a legacy <Code>{'Amulet_Transfer'}</Code> exercise on{' '}
        <Code>{'Splice.Amulet:Amulet'}</Code> throws an actionable error pointing at this page.
      </Callout>

      <H2 id="capabilities">Capability Matrix</H2>
      <UL>
        <LI><Strong>connect</Strong> — supported (Sigilry <Code>{'connect'}</Code> RPC + <Code>{'getPrimaryAccount'}</Code>)</LI>
        <LI><Strong>disconnect</Strong> — supported</LI>
        <LI><Strong>restore</Strong> — supported (silent <Code>{'status'}</Code> probe; no popup on reload)</LI>
        <LI><Strong>signMessage</Strong> — supported (passkey-signed)</LI>
        <LI><Strong>signTransaction</Strong> — <Strong>not supported</Strong>; fused into{' '}
          <Code>{'prepareExecute'}</Code>. Calling it throws{' '}
          <Code>{'CapabilityNotSupportedError'}</Code> pointing at <Code>{'submitTransaction'}</Code>.</LI>
        <LI><Strong>submitTransaction</Strong> — supported via{' '}
          <Code>{'prepareExecuteAndWait'}</Code>; receipt populated from{' '}
          <Code>{'tx.payload.updateId'}</Code>.</LI>
        <LI><Strong>ledgerApi</Strong> — supported (full Sigilry passthrough; matches Console / Nightly).</LI>
        <LI><Strong>events</Strong> — supported; <Code>{'txChanged'}</Code> bridged to PartyLayer{' '}
          <Code>{'tx:status'}</Code>.</LI>
        <LI><Strong>injected</Strong> — supported via <Code>{'window.canton'}</Code> with kernel.id guard.</LI>
      </UL>

      <H2 id="network-support">Network Support</H2>
      <P>
        Send currently operates exclusively on <Code>{'canton:mainnet'}</Code>.
      </P>
      <Callout type="note">
        <Strong>Demo-app display caveat:</Strong> the PartyLayer demo at{' '}
        <Code>{'localhost:3000'}</Code> defaults its network label to{' '}
        <Code>{'devnet'}</Code>. That label reflects the demo{"'"}s configuration — not the actual
        network the connected wallet sits on. Send{"'"}s adapter reads the live network from{' '}
        <Code>{'window.canton.getActiveNetwork()'}</Code> and reports{' '}
        <Code>{'canton:mainnet'}</Code> when Send is active. dApps that ship to production should
        configure <Code>{'PartyLayerKit'}</Code> with{' '}
        <Code>{'network="mainnet"'}</Code> when targeting Send.
      </Callout>

      <H2 id="troubleshooting">Troubleshooting</H2>
      <UL>
        <LI><Strong>{'"Send not detected"'}</Strong> — the extension is missing, or{' '}
          <Code>{'window.canton.kernel.id'}</Code> doesn{"'"}t match Send. The adapter intentionally
          refuses to claim foreign providers (e.g. another splice-wallet-kernel-compatible
          extension); install Send and reload.</LI>
        <LI><Strong>{'"Connection cancelled"'}</Strong> — the user dismissed the passkey prompt or the
          extension popup. Triggering connect again is safe.</LI>
        <LI><Strong>{'"Authentication Failed: Cannot reach authentication server"'}</Strong> — Send{"'"}s
          backend at <Code>{'auth.cantonwallet.com'}</Code> is unreachable. Check network and retry.</LI>
        <LI><Strong>{'"OAuth state mismatch"'}</Strong> — stale Send session. Clear cookies for{' '}
          <Code>{'cantonwallet.com'}</Code> and reconnect.</LI>
        <LI><Strong>{'"New signups are currently paused"'}</Strong> — Send Foundation has temporarily
          halted new account creation. Existing accounts continue to work.</LI>
        <LI><Strong>Transaction errors with hint{' '}{'"Execute Unknown on Unknown"'}</Strong> — legacy{' '}
          <Code>{'Amulet_Transfer'}</Code> exercise on <Code>{'Splice.Amulet:Amulet'}</Code>. Migrate to
          CIP-56 <Code>{'TransferFactory_Transfer'}</Code>; see{' '}
          <A href="/docs/token-transfers">Token Transfers</A>.</LI>
      </UL>

      <H2 id="security-notes">Security Notes</H2>
      <UL>
        <LI><Strong>Private keys never leave the extension.</Strong> Passkey signing happens on the
          user{"'"}s device through WebAuthn-PRF; PartyLayer never touches the underlying key
          material.</LI>
        <LI><Strong>Session JWT is held by the extension.</Strong> The adapter receives an access
          token in <Code>{'status.session.accessToken'}</Code> for the lifetime of the connection;
          PartyLayer{"'"}s session-persistence layer encrypts state at rest in the dApp{"'"}s
          configured storage.</LI>
        <LI><Strong>kernel.id guard.</Strong> Every Send adapter call verifies that{' '}
          <Code>{'window.canton.kernel.id === ldmohiccoioolenadmogclhoklmanpgi'}</Code> before
          forwarding. If a different splice-wallet-kernel-compatible extension grabs the global,
          Send adapter cleanly returns <Strong>not installed</Strong> and yields to the matching
          adapter rather than acting on a foreign provider.</LI>
      </UL>

      <H3 id="references">References</H3>
      <UL>
        <LI><A href="https://cantonwallet.com">Send (cantonwallet.com)</A></LI>
        <LI><A href="https://chromewebstore.google.com/detail/send/ldmohiccoioolenadmogclhoklmanpgi">Send Chrome extension</A></LI>
        <LI><A href="https://sigilry.org">Sigilry — open-source dApp SDK powering Send</A></LI>
        <LI><A href="/docs/token-transfers">CIP-56 Token Standard guide</A></LI>
        <LI><A href="/docs/wallets">Capability matrix across all six wallets</A></LI>
      </UL>

      <PrevNext />
    </>
  );
}
