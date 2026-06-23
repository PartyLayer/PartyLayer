'use client';

import { useDocs } from '../layout';

export default function ConnectButtonPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, A, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>ConnectButton</H1>
      <P>
        <Code>{'ConnectButton'}</Code> is a ready-to-use component that handles the entire
        wallet connection lifecycle. It renders a connect button when disconnected and shows
        the connected party ID with a disconnect dropdown when connected.
      </P>

      <H2 id="basic-usage">Basic Usage</H2>
      <CodeBlock language="tsx">{`import { ConnectButton } from '@partylayer/react';

function Navbar() {
  return (
    <nav>
      <h1>My dApp</h1>
      <ConnectButton />
    </nav>
  );
}`}</CodeBlock>

      <H2 id="props">Props</H2>
      <PropsTable data={[
        { prop: 'label', type: 'string', default: '"Connect Wallet"', description: 'Text shown on the button when disconnected.' },
        { prop: 'connectedLabel', type: '"address" | "wallet" | "custom"', default: '"address"', description: 'What to display when connected: truncated party ID, wallet ID, or custom format.' },
        { prop: 'formatAddress', type: '(partyId: string) => string', description: 'Custom formatter for the connected label. Only used when connectedLabel="custom".' },
        { prop: 'className', type: 'string', description: 'CSS class name for the outer container.' },
        { prop: 'style', type: 'CSSProperties', description: 'Inline styles for the outer container.' },
        { prop: 'showDisconnect', type: 'boolean', default: 'true', description: 'Whether to show the disconnect option in the connected dropdown.' },
      ]} />

      <H2 id="states">Button States</H2>
      <P>
        <Code>{'ConnectButton'}</Code> automatically transitions between three states:
      </P>

      <H3>Disconnected</H3>
      <P>
        Shows a yellow branded button with the connect label. Clicking opens the <Code>{'WalletModal'}</Code>.
      </P>
      <CodeBlock language="tsx">{`<ConnectButton label="Connect Wallet" />`}</CodeBlock>

      <H3>Connecting</H3>
      <P>
        While a wallet connection is in progress, the button shows a loading spinner.
        This state is automatic, no configuration needed.
      </P>

      <H3>Connected</H3>
      <P>
        Shows the connected party ID (truncated) with a green status dot. Clicking opens
        a dropdown with session details and a disconnect button.
      </P>
      <P>The dropdown shows:</P>
      <UL>
        <LI><Strong>Status badge</Strong>: green "CONNECTED" indicator</LI>
        <LI><Strong>Party ID</Strong>: the full connected party ID</LI>
        <LI><Strong>Wallet ID</Strong>: which wallet is connected</LI>
        <LI><Strong>Disconnect button</Strong>: cleanly ends the session</LI>
      </UL>

      <H2 id="connected-label">Connected Label Formats</H2>
      <CodeBlock language="tsx">{`// Show truncated party ID (default)
<ConnectButton connectedLabel="address" />
// Result: "party::abc1...xyz9"

// Show the wallet ID
<ConnectButton connectedLabel="wallet" />
// Result: "console"

// Custom format
<ConnectButton
  connectedLabel="custom"
  formatAddress={(partyId) => \`Connected: \${partyId.slice(0, 12)}...\`}
/>
// Result: "Connected: party::abc1..."`}</CodeBlock>

      <H2 id="custom-styling">Custom Styling</H2>
      <P>
        You can override styles with the <Code>{'style'}</Code> and <Code>{'className'}</Code> props:
      </P>
      <CodeBlock language="tsx">{`<ConnectButton
  style={{ borderRadius: 8, fontSize: 16 }}
  className="my-connect-button"
/>`}</CodeBlock>

      <Callout type="tip" title="Custom Button">
        If you need full control over the button rendering, use the <Code>{'WalletModal'}</Code> component
        directly with your own trigger button, plus the <Code>{'useAccount'}</Code> and <Code>{'useDisconnect'}</Code> hooks.
        See <A href="/docs/wallet-modal">WalletModal</A> for details.
      </Callout>

      <H2 id="without-connect-button">Building a Custom Connect Button</H2>
      <P>
        For full control, skip <Code>{'ConnectButton'}</Code> and use hooks directly:
      </P>
      <CodeBlock language="tsx">{`import { useState } from 'react';
import { WalletModal, useAccount, useDisconnect, truncatePartyId } from '@partylayer/react';

function CustomConnect() {
  const [modalOpen, setModalOpen] = useState(false);
  const { isConnected, party } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        <span>{truncatePartyId(String(party))}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setModalOpen(true)}>Connect</button>
      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={() => setModalOpen(false)}
      />
    </>
  );
}`}</CodeBlock>

      <PrevNext />
    </>
  );
}
