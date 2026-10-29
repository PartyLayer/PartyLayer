'use client';
import { useDocs } from '../layout';
export default function Content() {
  const { H1, H2, P, UL, LI, A, CodeBlock, Callout, PrevNext } = useDocs();
  return <>
    <H1>Upgrade an existing PartyLayer app</H1>
    <P>This guide targets React 3.1.2+, SDK 0.20.1+ and session 1.1.10+. Start from a working application and lockfile, commit that state, and use a branch. Transfer existing network, wallet, theme and authentication settings before replacing a connection boundary.</P>
    <H2 id="scope">Choose the scope</H2>
    <P>React v1/v2 applications should review hook mappings and their connection boundary. React 3.1.0/3.1.1 applications should update for coordinated cross-tab logout. SDK applications before 0.20 should review native response and cache changes. Vue and React Native applications keep their framework-specific integration; the React DOM kit is not a replacement for it.</P>
    <H2 id="install">Install once</H2>
    <CodeBlock language="bash">{'npm install @partylayer/react @tanstack/react-query'}</CodeBlock>
    <P>Use the existing package manager. The kit includes the SDK and supported wallet runtimes. Remove an old direct dependency only after checking the app no longer imports it. Existing compatibility integrations may remain intentional; there is no need to add a new wallet-specific package or upgrade every vendor SDK to the same major version.</P>
    <H2 id="providers">Mount one connection owner</H2>
    <P>For the default React experience, mount one PartyLayerKit and use ConnectButton. For Next.js App Router, put it in a client provider and keep the root layout server-side. An advanced application-owned client with PartyLayerProvider should keep that architecture unless you deliberately migrate it; adding another kit would create another owner.</P>
    <CodeBlock language="tsx">{`'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit } from '@partylayer/react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="devnet" appName="My dApp">
        {children}
      </PartyLayerKit>
    </QueryClientProvider>
  );
}`}</CodeBlock>
    <P>The QueryClientProvider wrapper is needed for optional /query hooks. The base connection UI can use PartyLayerKit alone. See the <A href="/docs/quick-start">quick start</A> for the complete root layout, Vite setup and default branded button.</P>
    <H2 id="hooks">Review hook contracts</H2>
    <UL>
      <LI>useAccount() reads the reactive account. Main-entry useSession() reads the session-store view; useClientSession() preserves the old SDK-session getter.</LI>
      <LI>Main-entry action hooks and @partylayer/react/query hooks have different return shapes. Check call arguments and mutation methods before changing an import.</LI>
      <LI>Keep your own stable QueryClient when using the query entry point. Read the <A href="/docs/hooks">hooks reference</A> for exact signatures.</LI>
    </UL>
    <H2 id="cip-0103">Preserve CIP-0103 and native session behavior</H2>
    <P>The official discovery client owns the native CIP-0103 connection. Do not restore another identity from a UI cache. Old native caches without the official provider hint require one explicit reconnect; failed live account/network checks must not show an old connected account. OneSwap requires a fresh connection.</P>
    <P>Native asProvider() Ledger API requests return raw wallet JSON. Migrate code that parsed result.response only on that path. The SDK ledgerApi() method retains its string envelope, and compatibility bridges keep their documented projections. Accounts, key metadata and native transaction events preserve their real provider shape.</P>
    <P>Read the <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/protocol-ownership.md">protocol decision</A> and the <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/migration.md">complete migration checklist</A>. Never automatically resubmit an uncertain transaction after a timeout or command-ID mismatch.</P>
    <H2 id="verify">Verify before shipping</H2>
    <UL>
      <LI>Build/typecheck changed call sites; test connect, rejection, restore, account/network changes and cross-tab logout.</LI>
      <LI>Check network/channel policy: Send is Mainnet-only; Vala requires Devnet beta. Configure WalletConnect/Bron with your own settings.</LI>
      <LI>Verify backend authentication independently. Validate transfers and swaps with valid commands, test funds and independent ledger confirmation.</LI>
    </UL>
    <Callout type="note">CLI 0.7.0 introduces offline --doctor diagnostics. Until published, the public @latest command may still resolve the previous CLI. Doctor checks installation metadata; it does not establish wallet or ledger acceptance.</Callout>
    <P>Use the <A href="/docs/ai-integration">AI integration guide</A> to give a coding assistant this same migration contract.</P>
    <PrevNext />
  </>;
}
