'use client';
import { useDocs } from '../layout';

export default function Content() {
  const { H1, H2, P, A, Callout } = useDocs();
  return <>
    <H1>Canton swap integration and settlement</H1>
    <P>PartyLayer supplies wallet connection, supported approvals and transaction lifecycle.
      Your chosen protocol supplies liquidity, quotes, execution rules and settlement. A message
      signature, allocation approval or confirmed deposit alone does not prove a completed swap.</P>
    <H2 id="flow">Keep wallet and protocol responsibilities explicit</H2>
    <P>Bind the server-authenticated user to the intended party and network. Obtain a current
      quote and present both issuer/id pairs, exact amounts, fees, minimum output and expiry.
      Store the accepted intent server-side, prepare its precise commands and fresh disclosures,
      then request one supported wallet action.</P>
    <P>Use <A href="/docs/transaction-lifecycle">transaction lifecycle</A> to correlate the
      original command with the ledger. Track the protocol separately until its output or refund
      is known, and refresh an authorized complete holdings snapshot. Reconcile lost responses;
      never replay a deposit merely because a read timed out.</P>
    <H2 id="oneswap">Concrete example: OneSwap&apos;s deposit workflow</H2>
    <P>The <A href="https://docs.oneswap.cc/quickstart">official OneSwap SDK guide</A> documents
      a deposit workflow. Keep its integrator key server-side and select Devnet explicitly for
      tests. The server quotes and creates a user-bound swap; PartyLayer requests the wallet&apos;s
      exact input transfer to that swap&apos;s deposit party before its deadline.</P>
    <P>Monitor the stored swap id through an owner-authorized backend endpoint. A returned output,
      a refund and an in-progress recovery are different outcomes. Recover the existing open swap
      and original deposit before allowing a new attempt. Verify supported instruments and the
      vendor&apos;s current limits in its <A href="https://docs.oneswap.cc/guides/swaps">lifecycle guide</A>.</P>
    <Callout type="warning">A protocol SDK is separate from the wallet provider. No new per-wallet
      PartyLayer package is needed. Never ship protocol credentials to the browser or bypass
      wallet approval through an unrestricted participant-admin proxy.</Callout>
    <H2 id="acceptance">Acceptance evidence</H2>
    <P>Record the accepted quote, wallet approval or rejection, original command id, actual ledger
      update, protocol output/refund and refreshed holdings. Test reload and account/network
      changes without duplicate writes. Live acceptance needs a valid vendor transaction,
      supported network, funded test accounts and user approval.</P>
    <P><A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/swaps.md">Full integration and acceptance guide</A> ·
      <A href="/docs/token-transfers">Token transfers</A> · <A href="/docs/wallet-balances">Wallet balances</A></P>
  </>;
}
