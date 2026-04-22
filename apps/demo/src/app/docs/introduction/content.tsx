'use client';

import { useDocs } from '../layout';

export default function IntroductionPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, A, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>Introduction</H1>
      <P>
        <Strong>PartyLayer</Strong> is an open-source SDK for integrating Canton Network wallets into your dApp.
        It provides a unified interface across every Canton wallet — registry-backed, verified, and type-safe —
        so you can focus on building your application, not wrestling with wallet APIs.
      </P>

      <P>
        Transfers follow Canton{"'"}s Token Standard (<Strong>CIP-56</Strong>) — the current
        protocol for Amulet and other token transfers. See the{' '}
        <A href="/docs/token-transfers">Token Transfers</A> guide for the full flow.
      </P>

      <Callout type="tip" title="Zero-Config React">
        With <Code>{'PartyLayerKit'}</Code> and <Code>{'ConnectButton'}</Code>, you can add full
        wallet connectivity to a React app in under 10 lines of code.
      </Callout>

      <H2 id="features">Key Features</H2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { title: 'Zero-Config React', desc: 'PartyLayerKit + ConnectButton for instant wallet integration. No boilerplate needed.' },
          { title: 'CIP-0103 Compliant', desc: 'Full implementation of the Canton dApp Standard — 10 methods, 4 events, typed errors.' },
          { title: '5 Wallet Adapters', desc: 'Console, Loop, Cantor8, and Nightly auto-registered. Bron available for enterprise.' },
          { title: 'Registry Discovery', desc: 'Verified wallets fetched from the PartyLayer registry with signature verification.' },
          { title: 'Type-Safe', desc: 'Branded types, strict TypeScript, and 12 typed error classes with stable error codes.' },
          { title: 'Themes & Customization', desc: 'Light, dark, and auto themes. Full theme customization with PartyLayerTheme.' },
        ].map(f => (
          <div key={f.title} style={{
            padding: 20, borderRadius: 10, border: '1px solid rgba(15,23,42,0.10)',
            background: '#FAFBFC',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0B0F1A', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <H2 id="why-partylayer">Why PartyLayer?</H2>

      <P>
        Without PartyLayer, integrating wallets on Canton means handling each wallet{"'"}s proprietary API,
        managing CIP-0103 compliance, building your own connection UI, and handling errors across
        different transport layers (PostMessage, deep links, QR codes, injected providers).
      </P>

      <P>
        With PartyLayer, you get a single, consistent interface that works with every Canton wallet.
        The SDK handles registry discovery, adapter negotiation, session management, and provides
        ready-to-use React components — all with TypeScript types and meaningful error messages.
      </P>

      <H3>Before PartyLayer</H3>
      <CodeBlock language="tsx">{`// Manual wallet integration — per wallet
const consoleWallet = await window.canton.console.request({ method: 'connect' });
const loopWallet = await connectViaQR('loop', { ... });
const nightlyWallet = window.nightly?.canton?.connect();
// Different APIs, different error handling, different UX...`}</CodeBlock>

      <H3>With PartyLayer</H3>
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="mainnet" appName="My dApp">
      <ConnectButton />
    </PartyLayerKit>
  );
}`}</CodeBlock>

      <H2 id="packages">Packages</H2>

      <UL>
        <LI><Code>{'@partylayer/sdk'}</Code> — Core SDK with <Code>{'createPartyLayer'}</Code>, client, adapters, and events</LI>
        <LI><Code>{'@partylayer/react'}</Code> — React hooks (<Code>{'useSession'}</Code>, <Code>{'useConnect'}</Code>, ...) and components (<Code>{'PartyLayerKit'}</Code>, <Code>{'ConnectButton'}</Code>, <Code>{'WalletModal'}</Code>)</LI>
        <LI><Code>{'@partylayer/core'}</Code> — Shared types, errors, and CIP-0103 type definitions</LI>
        <LI><Code>{'@partylayer/provider'}</Code> — CIP-0103 native Provider implementation and bridge</LI>
      </UL>

      <H2 id="getting-started">Getting Started</H2>

      <P>
        Ready to integrate? Head to the <A href="/docs/installation">Installation</A> guide to set up
        PartyLayer, or jump straight to the <A href="/docs/quick-start">Quick Start</A> for a complete
        working example.
      </P>

      <PrevNext />
    </>
  );
}
