'use client';

import { useDocs } from '../layout';

export default function Content() {
  const { H1, H2, P, Code, CodeBlock, Callout, UL, LI, A, Strong, PrevNext } = useDocs();
  return <>
    <H1>A RainbowKit-style wallet connection kit for Canton</H1>
    <P>PartyLayer gives React applications on Canton a ready-made Connect Wallet button, wallet picker, account menu, themes and connection hooks. One installation includes supported wallet runtimes. CIP-0103 remains the wallet communication standard; PartyLayer adds application UI and state above that foundation.</P>
    <Callout type="note">PartyLayer is an independent project. It is not RainbowKit, is not affiliated with Rainbow, and does not make EVM APIs work on Canton. This guide compares the developer experience, not complete feature parity.</Callout>
    <H2 id="install">Install the Canton React wallet kit</H2>
    <CodeBlock language="bash">{'npm install @partylayer/react @tanstack/react-query'}</CodeBlock>
    <P>Use React 18+ and PartyLayer React 3.1.0+ / SDK 0.20.0+. The SDK and supported wallet runtimes are included. You do not install a PartyLayer package for each wallet or import a separate stylesheet.</P>
    <CodeBlock language="tsx">{`// App.tsx — put this component in a 'use client' file in Next.js.
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="My Canton dApp">
      <ConnectButton />
    </PartyLayerKit>
  );
}`}</CodeBlock>
    <P>The button opens wallet selection and becomes an account menu after connection. The default experience includes Powered by PartyLayer attribution. Follow the <A href="/docs/quick-start">complete React and Next.js quick start</A> for provider placement and troubleshooting.</P>
    <H2 id="new-app">Start a new application</H2>
    <CodeBlock language="bash">{'npm create partylayer-app@latest my-dapp -- --template react-vite --pm npm\ncd my-dapp\nnpm run dev'}</CodeBlock>
    <P>For Next.js App Router, select <Code>next-ssr</Code> instead of <Code>react-vite</Code>. Both React starters include the branded connection experience. See <A href="/docs/installation">installation and framework requirements</A>.</P>
    <H2 id="what-maps">What carries over from RainbowKit</H2>
    <UL>
      <LI><Strong>Connection UI:</Strong> use PartyLayerKit and ConnectButton for wallet selection, connection state and the account menu.</LI>
      <LI><Strong>Hooks:</Strong> useAccount reports Canton party identity; useWallets, useConnect and useDisconnect manage the wallet journey.</LI>
      <LI><Strong>Themes:</Strong> configure colors, light/dark mode and layout through the <A href="/docs/theming">theme system</A>.</LI>
      <LI><Strong>Authentication:</Strong> connect a backend-issued challenge and independently verified signature through the <A href="/docs/authentication">authentication integration</A>.</LI>
      <LI><Strong>Activity:</Strong> use the <A href="/docs/transaction-lifecycle">transaction lifecycle</A> to report submitted, confirmed, failed or unknown outcomes.</LI>
    </UL>
    <P>RainbowKit documents its own React, wagmi and viem setup in the <A href="https://rainbowkit.com/docs/installation">official installation guide</A>. For data-layer differences, read <A href="/docs/wagmi-for-canton">wagmi concepts on Canton</A>.</P>
    <H2 id="wallets">Choose wallets and networks explicitly</H2>
    <P>The <A href="/wallets">Canton wallet directory</A> lists actual registry entries, networks and capabilities. Choose devnet, testnet or mainnet in your kit configuration. Send is Mainnet-only in the catalog; Vala is a Devnet beta opt-in using <Code>channel="beta"</Code>. WalletConnect needs your project ID, and Bron needs your application-owned credentials. Hosted-wallet login and wallet approvals remain user actions.</P>
    <H2 id="transactions">Connection, sign-in, send and swap have different requirements</H2>
    <P>Canton uses party-scoped visibility, Daml contracts and choices. An EVM address, ABI, ENS name or Sign-In with Ethereum flow cannot be substituted for a Canton party or authorization decision.</P>
    <P>A successful connection or message signature does not prove a token transfer or swap succeeded. Your application constructs valid token/protocol commands; the selected wallet must support the required operation, and the resulting ledger outcome must be verified. Read <A href="/docs/token-transfers">token transfers</A> and the <A href="/docs/production-checklist">production checklist</A>.</P>
    <H2 id="next">Build and verify your integration</H2>
    <P>Open the <A href="/kit-demo">interactive wallet kit demo</A>, follow the <A href="/docs/quick-start">quick start</A>, or use <A href="/docs/integration-support">integration support</A> with a minimal reproduction. Live wallet and ledger acceptance is recorded separately from automated checks; see the <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-acceptance.md">acceptance evidence</A>.</P>
    <PrevNext />
  </>;
}
