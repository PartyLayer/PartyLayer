'use client';

import { useDocs } from '../layout';

const STUDIO = 'https://studio.partylayer.xyz';

export default function CookbookContent() {
  const { H1, H2, P, Code, CodeBlock, Callout, A, Strong, PrevNext } = useDocs();

  return (
    <>
      <H1>Pattern Cookbook</H1>
      <P>
        Copy-paste-ready recipes for the most common Canton wallet flows, built on the real
        PartyLayer hooks. Every recipe has a matching <Strong>live, editable scenario</Strong> in{' '}
        <A href={STUDIO}>PartyLayer Studio</A> — open it, edit the code, and watch it run against a
        mock CIP-0103 wallet — plus a frank <Strong>“When not to use”</Strong> note so you reach for
        the right tool. PartyLayer is MIT-licensed and fully open source.
      </P>

      {/* ── E1 ─────────────────────────────────────────────────────────── */}
      <H2 id="connect-a-wallet">1. Connect a wallet</H2>
      <P>
        List the available wallets with <Code>{'useWallets()'}</Code> and connect with{' '}
        <Code>{'useConnect()'}</Code>. After a successful connect the active party is available from{' '}
        <Code>{'useAccount()'}</Code>.
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerKit, useWallets, useConnect, useAccount } from '@partylayer/react';

function ConnectPanel() {
  const { wallets } = useWallets();
  const { connect, isConnecting, error } = useConnect();
  const { party } = useAccount();

  if (party) return <p>Connected — {party}</p>;

  return (
    <>
      {wallets.map((w) => (
        <button key={String(w.walletId)} disabled={isConnecting}
          onClick={() => connect({ walletId: w.walletId })}>
          {isConnecting ? 'Connecting…' : 'Connect ' + w.name}
        </button>
      ))}
      {error && <p role="alert">{error.message}</p>}
    </>
  );
}

export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectPanel />
    </PartyLayerKit>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Connect a wallet”</A>
      </P>
      <Callout type="warning" title="When not to use">
        Connect is a <Strong>browser</Strong> wallet flow — it needs a user gesture and a wallet
        extension/provider, so it has no place in server-side or headless code. Don’t call{' '}
        <Code>{'connect()'}</Code> on mount or automatically; trigger it from an explicit user
        action. To revive an <em>existing</em> session after a reload, use Reconnect (recipe 4), not
        a fresh connect.
      </Callout>

      {/* ── E2 ─────────────────────────────────────────────────────────── */}
      <H2 id="sign-a-message">2. Sign a message</H2>
      <P>
        <Code>{'useSignMessage()'}</Code> asks the connected wallet to sign an arbitrary string and
        returns the signature, the signing party, and the original message.
      </P>
      <CodeBlock language="tsx">{`import { useSignMessage } from '@partylayer/react';

function SignButton() {
  const { signMessage, isSigning, error } = useSignMessage();

  async function onSign() {
    const signed = await signMessage({ message: 'Sign in to My dApp' });
    if (signed) {
      console.log(signed.signature, signed.partyId, signed.message);
    }
  }

  return (
    <>
      <button onClick={onSign} disabled={isSigning}>
        {isSigning ? 'Signing…' : 'Sign message'}
      </button>
      {error && <p role="alert">{error.message}</p>}
    </>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Sign a message”</A>
      </P>
      <Callout type="warning" title="When not to use">
        A signed message proves control of a key at a <Strong>single moment</Strong> — it is not an
        ongoing session and it changes no on-chain state. Don’t use it as a session substitute
        (track the session via <Code>{'useAccount()'}</Code> / <Code>{'useSession()'}</Code>), and
        don’t use it to move funds or update a contract — that’s a transaction (recipe 3).
      </Callout>

      {/* ── E3 ─────────────────────────────────────────────────────────── */}
      <H2 id="submit-a-transaction">3. Submit a transaction</H2>
      <P>
        <Code>{'useSubmitTransaction()'}</Code> submits a signed transaction and resolves a receipt
        ({'{ transactionHash, commandId, updateId }'}). The wallet also emits a{' '}
        <Code>{'txChanged'}</Code> lifecycle (<Code>{'pending → signed → executed'}</Code>) you can
        subscribe to for a live status.
      </P>
      <CodeBlock language="tsx">{`import { useState } from 'react';
import { useSubmitTransaction } from '@partylayer/react';

function SubmitButton({ signedTx }: { signedTx: unknown }) {
  const { submitTransaction, isSubmitting, error } = useSubmitTransaction();
  const [updateId, setUpdateId] = useState<string | null>(null);

  async function onSubmit() {
    const receipt = await submitTransaction({ signedTx });
    if (receipt) setUpdateId(receipt.updateId ?? null);
  }

  return (
    <>
      <button onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit transaction'}
      </button>
      {updateId && <p>Executed — updateId {updateId}</p>}
      {error && <p role="alert">{error.message}</p>}
    </>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Submit a transaction”</A> (watch the
        Pending → Signed → Executed stepper).
      </P>
      <Callout type="warning" title="When not to use">
        Submit is <Strong>capability-gated</Strong>: it only works when the connected wallet’s
        adapter implements it, otherwise it throws <Code>{'CapabilityNotSupportedError'}</Code>.
        Don’t assume every wallet can submit — check capabilities first (recipe 9). For
        sign-only proof without broadcasting, use recipe 2.
      </Callout>

      {/* ── E4 ─────────────────────────────────────────────────────────── */}
      <H2 id="reconnect-a-session">4. Reconnect a session (transient resilience)</H2>
      <P>
        <Code>{'useSession().restore()'}</Code> re-probes the live wallet and rehydrates the
        session: status moves <Code>{'connected → reconnecting → connected'}</Code>. This is the
        same path that runs on a page reload, so a transient provider drop heals itself with no
        fresh login.
      </P>
      <CodeBlock language="tsx">{`import { useSession, useAccount } from '@partylayer/react';

function ReconnectButton() {
  const { restore } = useSession();
  const { status } = useAccount(); // 'connected' | 'reconnecting' | 'disconnected' | ...

  return (
    <button onClick={() => restore()}>
      Reconnect (status: {status})
    </button>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Session resilience — reconnect”</A>
      </P>
      <Callout type="warning" title="When not to use">
        <Code>{'restore()'}</Code> re-probes an <Strong>existing</Strong> session (reload / transient
        drop) — it is not a fresh login. If there is no session to revive it simply lands{' '}
        <Code>{'disconnected'}</Code>; for a first-time connection use recipe 1. And after an{' '}
        <em>explicit</em> disconnect (recipe 5) restore won’t bring it back — that’s intentional.
      </Callout>

      {/* ── E5 ─────────────────────────────────────────────────────────── */}
      <H2 id="terminal-disconnect">5. Handle a terminal disconnect</H2>
      <P>
        <Code>{'useSession().disconnect()'}</Code> ends the session deliberately. It is{' '}
        <Strong>terminal</Strong>: the session is cleared and never auto-reconnects, which is exactly
        the resilience boundary — a transient drop reconnects, an explicit disconnect does not.
      </P>
      <CodeBlock language="tsx">{`import { useSession, useAccount } from '@partylayer/react';

function DisconnectButton() {
  const { disconnect } = useSession();
  const { isConnected } = useAccount();

  if (!isConnected) return <span>Disconnected</span>;
  return <button onClick={() => disconnect()}>Disconnect</button>;
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Session resilience — disconnect”</A>
      </P>
      <Callout type="warning" title="When not to use">
        Use this only for a <Strong>user-intended</Strong> sign-out. Don’t call{' '}
        <Code>{'disconnect()'}</Code> on a transient network blip you actually want to recover from —
        that suppresses auto-reconnect; let the resilience path (recipe 4) handle transient drops
        instead.
      </Callout>

      {/* ── E6 ─────────────────────────────────────────────────────────── */}
      <H2 id="react-query">6. PartyLayer + React Query</H2>
      <P>
        PartyLayer has no React Query dependency, but it composes cleanly with it (the wagmi
        pattern): model the session as a <Code>{'useQuery'}</Code> and connect/sign/submit as{' '}
        <Code>{'useMutation'}</Code>, then <Code>{'invalidateQueries'}</Code> to refetch.
      </P>
      <CodeBlock language="tsx">{`import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PartyLayerKit, usePartyLayer, useConnect } from '@partylayer/react';

function Session() {
  const client = usePartyLayer();
  const qc = useQueryClient();
  const { connect } = useConnect();

  const session = useQuery({ queryKey: ['session'], queryFn: () => client.getActiveSession() });
  const connectMut = useMutation({
    mutationFn: (walletId: string) => connect({ walletId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });

  return <pre>{session.data ? String(session.data.partyId) : 'no session'}</pre>;
}

const queryClient = new QueryClient();
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="devnet" appName="My dApp">
        <Session />
      </PartyLayerKit>
    </QueryClientProvider>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “React Query + DevTools”</A>
      </P>
      <Callout type="warning" title="When not to use">
        Only reach for this if you already use (or want) React Query. PartyLayer’s built-in hooks are
        reactive on their own — for non-React apps or simple cases, adding a query client is extra
        weight for no gain.
      </Callout>

      {/* ── E7 ─────────────────────────────────────────────────────────── */}
      <H2 id="multi-framework">7. Multi-framework (React / Vue / Vanilla)</H2>
      <P>
        The same connect flow across the three bindings. React uses <Code>{'useConnect()'}</Code>;
        Vue uses <Code>{'@partylayer/vue'}</Code>’s plugin + composables; Vanilla uses the SDK client
        directly.
      </P>
      <CodeBlock language="tsx">{`// React — @partylayer/react
import { useConnect, useWallets } from '@partylayer/react';
const { wallets } = useWallets();
const { connect } = useConnect();
// connect({ walletId: wallets[0].walletId })`}</CodeBlock>
      <CodeBlock language="html">{`<!-- Vue — @partylayer/vue -->
<script setup>
  import { useSession, useAccount } from '@partylayer/vue';
  const { connect, isConnecting } = useSession();
  const { party } = useAccount();
</script>
<template>
  <button v-if="!party" @click="connect()" :disabled="isConnecting">Connect</button>
  <p v-else>Connected: {{ party }}</p>
</template>

<!-- main.js: install the plugin with a CIP-0103 provider -->
<!-- app.use(createPartyLayerSession({ provider })) -->`}</CodeBlock>
      <CodeBlock language="ts">{`// Vanilla — @partylayer/sdk
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({ network: 'devnet', app: { name: 'My dApp' } });
const wallets = await client.listWallets();
const session = await client.connect({ walletId: wallets[0].walletId });
console.log(session.partyId);`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Framework toggle”</A> (React / Vue / Vanilla, same
        demo).
      </P>
      <Callout type="warning" title="When not to use">
        The toggle is a <Strong>teaching device</Strong>, not a runtime switch. Pick one binding for
        your app — don’t ship all three or swap frameworks at runtime.
      </Callout>

      {/* ── E8 ─────────────────────────────────────────────────────────── */}
      <H2 id="error-handling">8. Error handling</H2>
      <P>
        <Code>{'useConnect()'}</Code> never throws — it resolves <Code>{'null'}</Code> and exposes a
        typed <Code>{'error'}</Code> (a <Code>{'PartyLayerError'}</Code> subclass). Branch on the
        class (or <Code>{'error.code'}</Code>), and clear it with <Code>{'reset()'}</Code>.
      </P>
      <CodeBlock language="tsx">{`import { useConnect } from '@partylayer/react';
import { UserRejectedError, WalletNotInstalledError } from '@partylayer/core';

function ConnectWithErrors({ walletId }: { walletId: string }) {
  const { connect, isConnecting, error, reset } = useConnect();

  async function onConnect() {
    reset();
    await connect({ walletId }); // resolves null on failure; sets \`error\`
  }

  function friendly(e: NonNullable<typeof error>) {
    if (e instanceof UserRejectedError) return 'You cancelled the request.';
    if (e instanceof WalletNotInstalledError) return 'That wallet isn’t installed.';
    return 'Something went wrong — please try again.';
  }

  return (
    <>
      <button onClick={onConnect} disabled={isConnecting}>Connect</button>
      {error && <p role="alert">{friendly(error)}</p>}
    </>
  );
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Connect a wallet”</A> — the Mock driver’s failure
        picker fires each path (User rejected, Insufficient traffic, Synchronizer error, Transaction
        timeout, Generic error). See also <A href="/docs/error-handling">Error Handling</A>.
      </P>
      <Callout type="warning" title="When not to use">
        Don’t swallow errors silently, and don’t surface a raw <Code>{'error.code'}</Code> to end
        users — map codes to friendly copy as above. A cancelled request
        (<Code>{'UserRejectedError'}</Code>) is normal, not a crash — handle it as a no-op.
      </Callout>

      {/* ── E9 (headroom) ──────────────────────────────────────────────── */}
      <H2 id="capability-gating">9. Capability gating</H2>
      <P>
        Not every wallet supports every operation. Capability-gated calls like submit throw{' '}
        <Code>{'CapabilityNotSupportedError'}</Code> when the connected adapter lacks the capability,
        so check up front (or handle the error) rather than assuming.
      </P>
      <CodeBlock language="tsx">{`import { usePartyLayer, useSubmitTransaction } from '@partylayer/react';
import { CapabilityNotSupportedError } from '@partylayer/core';

function SubmitIfSupported({ signedTx }: { signedTx: unknown }) {
  const client = usePartyLayer();
  const { submitTransaction } = useSubmitTransaction();

  async function onSubmit() {
    const session = await client.getActiveSession();
    const caps = session?.capabilitiesSnapshot ?? [];
    if (!caps.includes('submitTransaction')) {
      return alert('This wallet can’t submit transactions.');
    }
    try {
      await submitTransaction({ signedTx });
    } catch (e) {
      if (e instanceof CapabilityNotSupportedError) {
        alert('This wallet can’t submit transactions.');
      }
    }
  }

  return <button onClick={onSubmit}>Submit (if supported)</button>;
}`}</CodeBlock>
      <P>
        <A href={STUDIO}>Try it live in Studio → “Submit a transaction”</A> (the demo wallet supports
        submit; a wallet without it throws here).
      </P>
      <Callout type="warning" title="When not to use">
        Don’t gate on capabilities you don’t actually call — over-checking clutters the UI. And don’t
        rely on a stale snapshot across reconnects; re-read capabilities after the session changes.
      </Callout>

      <PrevNext />
    </>
  );
}
