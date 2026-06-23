'use client';

import { useDocs } from '../layout';

export default function WalletModalPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>WalletModal</H1>
      <P>
        <Code>{'WalletModal'}</Code> is a multi-state modal dialog that guides users through the
        wallet connection flow. It displays available wallets, handles the connection process, and
        shows success, error, or installation states.
      </P>

      <Callout type="tip">
        <Code>{'ConnectButton'}</Code> uses <Code>{'WalletModal'}</Code> internally. Use <Code>{'WalletModal'}</Code> directly
        only if you need a custom trigger button or want to control the modal state yourself.
      </Callout>

      <H2 id="basic-usage">Basic Usage</H2>
      <CodeBlock language="tsx">{`import { useState } from 'react';
import { WalletModal } from '@partylayer/react';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Connect Wallet
      </button>
      <WalletModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConnect={(sessionId) => {
          console.log('Connected!', sessionId);
          setIsOpen(false);
        }}
      />
    </>
  );
}`}</CodeBlock>

      <H2 id="props">Props</H2>
      <PropsTable data={[
        { prop: 'isOpen', type: 'boolean', description: 'Controls whether the modal is visible.' },
        { prop: 'onClose', type: '() => void', description: 'Called when the modal is dismissed (overlay click, close button, or Escape key).' },
        { prop: 'onConnect', type: '(sessionId: string) => void', description: 'Called when a wallet connection succeeds. Receives the new session ID.' },
        { prop: 'walletIcons', type: 'Record<string, string>', description: 'Custom wallet icon URLs, keyed by walletId. Overrides registry and PartyLayerKit icons.' },
      ]} />

      <H2 id="flow-states">Modal Flow States</H2>
      <P>
        The modal transitions through several states during the connection process:
      </P>

      <H3>1. Wallet List</H3>
      <P>
        The default view showing all available wallets. Wallets are grouped into two categories:
      </P>
      <UL>
        <LI><Strong>CIP-0103 Native</Strong>: wallets flagged <Code>{'cip0103.native'}</Code> in the registry (shown first with a "CIP-0103" badge)</LI>
        <LI><Strong>Registry Wallets</Strong>: verified wallets from the PartyLayer registry</LI>
      </UL>
      <P>
        Each wallet card shows the wallet name, icon, and a brief description. Verified wallets
        display a verification badge.
      </P>

      <H3>2. Connecting</H3>
      <P>
        After selecting a wallet, the modal shows a connecting state with the wallet{"'"}s icon
        and a spinner animation. The wallet{"'"}s native UI (extension popup, QR code, deep link)
        activates during this phase.
      </P>

      <H3>3. Success</H3>
      <P>
        On successful connection, a success animation plays and the <Code>{'onConnect'}</Code> callback
        fires with the session ID. The modal auto-closes after a brief delay.
      </P>

      <H3>4. Error</H3>
      <P>
        If connection fails, the modal shows the error message with a "Try Again" button.
        Common errors include user rejection, timeout, and transport failures.
      </P>

      <H3>5. Not Installed</H3>
      <P>
        If the selected wallet isn{"'"}t detected, the modal shows an installation prompt with a
        link to the wallet{"'"}s website (from the wallet{"'"}s <Code>{'website'}</Code> field, with a
        built-in fallback URL for known wallets). Mobile flows may also show a deep-link button.
      </P>

      <H2 id="registry-status">Registry Status</H2>
      <P>
        The modal displays a subtle registry status indicator showing whether wallet data is
        from a live registry fetch, cached, or if the registry is unreachable (with an offline badge).
      </P>

      <H2 id="keyboard">Keyboard Navigation</H2>
      <UL>
        <LI><Code>{'Escape'}</Code>: closes the modal (explicit handler)</LI>
        <LI>Wallet options are standard buttons, so <Code>{'Tab'}</Code> moves focus between them and <Code>{'Enter'}</Code> or <Code>{'Space'}</Code> activates the focused wallet (native browser behavior)</LI>
      </UL>

      <H2 id="custom-icons">Custom Wallet Icons</H2>
      <P>
        You can override wallet icons at the modal level (in addition to <Code>{'PartyLayerKit'}</Code>):
      </P>
      <CodeBlock language="tsx">{`<WalletModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConnect={handleConnect}
  walletIcons={{
    console: '/my-custom-console-icon.png',
    loop: '/my-custom-loop-icon.svg',
  }}
/>`}</CodeBlock>

      <Callout type="note">
        Icons passed to <Code>{'WalletModal'}</Code> merge with (and override) icons from <Code>{'PartyLayerKit'}</Code>{"'"}s
        {' '}<Code>{'walletIcons'}</Code> prop.
      </Callout>

      <PrevNext />
    </>
  );
}
