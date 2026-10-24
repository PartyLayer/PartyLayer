'use client';

import { useDocs } from '../layout';

export default function TransactionLifecycleContent() {
  const { H1, H2, P, Code, CodeBlock, Callout, A } = useDocs();
  return <>
    <H1>Transaction lifecycle and recent activity</H1>
    <P>Use useTransactionFlow for wallet approval, submission, independent ledger confirmation and
      recent activity in the ready-made account panel. The application/protocol still constructs
      valid Canton commands and the operation-specific transfer or swap flow.</P>
    <H2 id="submit-once-and-confirm-separately">Submit once and confirm separately</H2>
    <CodeBlock language="tsx">{`import { TransactionToast, useTransactionFlow } from '@partylayer/react';
import type { TransactionConfirmation } from '@partylayer/react';

const flow = useTransactionFlow({
  confirm: async ({ transaction, signal }): Promise<TransactionConfirmation> => {
    const response = await fetch('/api/transactions/status', {
      method: 'POST', credentials: 'same-origin', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyId: transaction.partyId, networkId: transaction.networkId,
        updateId: transaction.receipt?.updateId,
        commandId: transaction.receipt?.commandId,
        transactionHash: transaction.receipt?.transactionHash,
      }),
    });
    if (!response.ok) throw new Error('Ledger status is unavailable');
    return response.json();
  },
});

// Explicit user action with valid app/protocol commands:
const result = await flow.submitTransaction({ signedTx: commands });
// Inspect result.status; promise resolution is not ledger confirmation.

<TransactionToast status={flow.transaction?.status ?? 'idle'}
  receipt={flow.transaction?.receipt} error={flow.transaction?.error} />

// A separate read-only action; never sends the commands again:
await flow.reconcile(result.id);`}</CodeBlock>
    <P>The status endpoint belongs to your app. Authorize the party/network server-side and
      correlate the lookup to the original command or business intent. Return confirmed with a
      real updateId only for the intended ledger transaction, failed with a reason for an
      authoritative failure, or unknown when no definitive result is available. With no wallet
      identifier, use the app&apos;s original command/intent or keep the result unknown.</P>
    <H2 id="status-and-retry-semantics">Status and retry semantics</H2>
    <P><Code>awaitingApproval</Code> means a wallet request is pending, not that a prompt was
      definitely displayed. <Code>submitted</Code> means a receipt/acknowledgement returned.
      <Code>confirmed</Code> requires the independent ledger lookup and a real update id.
      <Code>rejected</Code> is an explicit provider user rejection. <Code>failed</Code> is a
      preflight or authoritative ledger failure. <Code>unknown</Code> covers lost responses,
      invalid/conflicting confirmation and read timeouts.</P>
    <Callout type="warning">A command id, signature, local UI id or elapsed time does not confirm a
      transaction. Do not offer Send again for an unknown transaction until its original result
      is reconciled. The timeout/AbortSignal stops a read; it does not cancel an issued wallet write.</Callout>
    <P>Without confirm, an acknowledgement stays submitted. Confirmation defaults to 30 seconds,
      configurable from 1ms to five minutes. Local precondition/duplicate-request errors reject;
      otherwise submitTransaction resolves a status record. A pending response stays attached to
      the original wallet/party/network, and a new identity cannot reconcile it.</P>
    <P>Automatic retry is disabled in useSubmitTransaction, useChoice, transfer/instruction actions,
      allocation creation/actions and allocation-request actions, including global or explicit
      per-mutation retry settings. Query retry policies remain available. A separate explicit
      submission is still app intent, so applications must manage command/intent deduplication.</P>
    <H2 id="recent-transactions-and-account-scope">Recent transactions and account scope</H2>
    <P>PartyLayerProvider and PartyLayerKit include the journal. Activity from useTransactionFlow
      appears in the standard ConnectButton account panel automatically, filtered by wallet,
      party and network. The panel shows the actual network and wallet-side recovery guidance.
      CIP-0103 does not define universal set-primary-account or switch-network methods; reconnect
      a wallet that does not notify the application of its changes.</P>
    <P><Code>useRecentTransactions()</Code> reads the shared current-account journal.
      <Code>{'RecentTransactions transactions={records}'}</Code> renders a custom view. The panel
      shows five entries, the store retains at most 100 and the account view returns twenty.
      Each flow also maintains its own twenty-entry history. Reconcile using that flow&apos;s id.</P>
    <P>The journal is in memory and is not sent to storage or telemetry. Reloading loses it; it
      is not a full ledger-history indexer. Replacing the SDK client resets the shared store
      without remounting application children. Existing mutation hooks, direct SDK calls and
      external writes are not automatically enrolled. Full history comes from an authorized
      application backend/indexer.</P>
    <H2 id="transfers-swaps-and-holdings">Transfers, swaps and holdings</H2>
    <P>Acceptance requires a valid operation, supported wallet/network, required preapprovals and
      actual ledger outcomes. A message signature alone proves neither send nor swap. Private
      Canton holdings are contract data, not a universal public balance endpoint. Use the typed
      useTokenHoldings query with an authorized app fetcher or supported wallet ledger proxy,
      preserve decimal strings and key reads by party/network and instrument admin/id.</P>
    <P><A href="/docs/wallet-balances">Wallet balances</A> · <A href="/docs/token-transfers">Token transfers</A> ·
      <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/transaction-lifecycle.md">Full GitHub guide</A></P>
    <P>Automated fixtures cover lifecycle, retry safety and identity isolation. Final live sends
      and protocol-specific swaps remain separate acceptance evidence.</P>
  </>;
}
