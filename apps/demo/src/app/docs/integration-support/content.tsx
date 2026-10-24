'use client';
import { useDocs } from '../layout';
export default function Content() {
  const { H1, H2, P, UL, LI, A, CodeBlock, Callout, PrevNext } = useDocs();
  return <>
    <H1>Canton wallet integration support</H1>
    <P>Start with the ready-made React kit or a generated application. If an integration gets stuck, a small reproduction helps maintainers isolate application configuration, PartyLayer behavior and wallet-provider responses.</P>
    <CodeBlock language="bash">{'npm install @partylayer/react @tanstack/react-query'}</CodeBlock>
    <P>Follow the <A href="/docs/quick-start">React and Next.js quick start</A>, use the <A href="/docs/installation">application generator</A>, and check the <A href="/wallets">wallet network and capability directory</A>.</P>
    <H2 id="application">Application teams</H2>
    <UL>
      <LI>Include package versions, framework, browser, target network and wallet name.</LI>
      <LI>Link a minimal public reproduction with no credentials, plus the expected and observed result.</LI>
      <LI>Say which step fails: discovery, connect, restore, sign-in, message signing, transaction submission or independent confirmation.</LI>
      <LI>For transactions, use a test network and share only redacted diagnostics that you are authorized to make public.</LI>
    </UL>
    <P><A href="https://github.com/PartyLayer/PartyLayer/issues/new?template=integration.yml">Open an integration support request</A>. Requests are public; there is no guaranteed response time or implied wallet-vendor support agreement.</P>
    <Callout type="warning">Never include seed phrases, private keys, access tokens, session cookies, API credentials or private ledger data. For a security vulnerability, follow the repository&apos;s <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/security-production.md">security reporting guide</A> instead of posting a public reproduction.</Callout>
    <H2 id="wallet-provider">Wallet providers</H2>
    <P>Use the shared CIP-0103 announce or official provider-adapter path described in the <A href="/docs/generic-bridge">generic provider guide</A>. Submit registry metadata and evidence through a pull request. New wallets do not need a new PartyLayer-specific package.</P>
    <P>Provide supported networks, capabilities, current SDK versions, setup requirements and a usable test flow. Registry inclusion and automated conformance do not replace live connect, rejection, signing, restoration, disconnection and ledger acceptance.</P>
    <H2 id="reference">Share a verified integration</H2>
    <P>If your application uses PartyLayer, select “Share a live integration” in the support form and provide the public URL, version and network. Maintainers verify submissions before adding references; submitting a URL does not automatically publish a logo or endorsement. State logo attribution permission explicitly.</P>
    <PrevNext />
  </>;
}
