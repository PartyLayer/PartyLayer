# Transaction lifecycle and recent activity

Use `useTransactionFlow` for the ready-made wallet transaction lifecycle. It
submits once, separates wallet approval from ledger confirmation and records
recent activity in the same `PartyLayerProvider`/`PartyLayerKit` as `ConnectButton`.
It does not construct a transfer or swap: the application/protocol still creates
valid Canton commands, disclosures and token-standard approval flows.

## Submit once and confirm separately

```tsx
import { TransactionToast, useTransactionFlow } from '@partylayer/react';
import type { TransactionConfirmation } from '@partylayer/react';

function SendPreparedCommands({ commands }: { commands: { commandId: string; [key: string]: unknown } }) {
  const flow = useTransactionFlow({
    confirmationTimeoutMs: 30_000,
    confirm: async ({ transaction, signal }): Promise<TransactionConfirmation> => {
      // A read-only application endpoint, authorized for this party/network.
      // Look up an actual updateId/commandId/hash or the app's known intent.
      // Never send commands again from this endpoint.
      const response = await fetch('/api/transactions/status', {
        method: 'POST', credentials: 'same-origin', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: transaction.partyId, networkId: transaction.networkId,
          updateId: transaction.receipt?.updateId,
          commandId: transaction.commandId,
          transactionHash: transaction.receipt?.transactionHash,
        }),
      });
      if (!response.ok) throw new Error('Ledger status is unavailable');
      return response.json();
    },
  });

  return <>
    <button disabled={flow.isPending}
      onClick={() => { void flow.submitTransaction({ signedTx: commands }, { commandId: commands.commandId }).catch(console.error); }}>
      Send
    </button>
    <TransactionToast status={flow.transaction?.status ?? 'idle'}
      receipt={flow.transaction?.receipt} error={flow.transaction?.error} />
    {flow.transaction?.status === 'unknown' && (
      <button onClick={() => { void flow.reconcile(flow.transaction!.id).catch(console.error); }}>
        Check ledger status
      </button>
    )}
  </>;
}
```

The status endpoint is application-owned. Verify the authenticated party/network
on the server rather than trusting those request fields. Return
`{ status: 'confirmed', updateId }` only after observing the intended transaction
on the ledger, `{ status: 'failed', reason }` for an authoritative ledger failure,
or `{ status: 'unknown', reason? }` when no definitive outcome exists. An app must
correlate a lookup with its original command/intent; an unrelated successful
transaction is not evidence. If the wallet lost its response and no identifier
is available, use the application's original business intent/command identifier
or leave the result unknown. A local UI id is never a ledger lookup key.

## Status and retry semantics

| Status | Meaning |
| --- | --- |
| `awaitingApproval` | Wallet request is in progress; this does not imply the wallet already displayed a prompt |
| `submitted` | Wallet call returned a receipt/acknowledgement; independent confirmation is still outstanding |
| `confirmed` | The application ledger lookup confirmed the intended transaction and returned a real update id |
| `rejected` | Provider explicitly reported user rejection (`4001` or `USER_REJECTED`) |
| `failed` | A preflight failed before submission, or the authoritative ledger lookup reported failure |
| `unknown` | Submission response was lost, confirmation timed out/failed, or the confirmation response was invalid |

`submitTransaction()` resolves a record containing the actual status. Promise
resolution is not proof of confirmation. Local precondition/duplicate-request
errors reject. Calls for a different account/client before submission are
stopped; a response from an already-issued request remains bound to its original
wallet/party/network. It is not shown as the new account's activity.

Without `confirm`, a returned acknowledgement stays `submitted`. A command id,
signature, local id or merely elapsed time never produces `confirmed`. Conflicting
update ids and read errors produce `unknown`. Confirmation is bounded to 30s by
default (configurable from 1ms to five minutes) and receives an AbortSignal. This
stops waiting for a read, not a transaction already handed to the wallet.

`reconcile(id)` repeats only the read-only lookup; it never resubmits. Do not offer
an ordinary Send-again action for an unknown transaction until its original
outcome is reconciled. An explicit new submission is still application intent,
so applications must manage deduplication/business command ids appropriately.

Automatic retry is also disabled in the existing write mutations:
`useSubmitTransaction`, `useChoice`, token transfer/instruction actions, allocation
creation/actions and allocation-request actions. Global QueryClient and explicit
per-mutation retry settings cannot replay these writes. Query retry policies are
unchanged. A response timeout after an accepted ledger write is the regression
these guards cover.

## Recent transactions and account scope

`PartyLayerProvider` supplies an in-memory transaction journal automatically;
`PartyLayerKit` includes it. Transactions using `useTransactionFlow` appear in
the standard `ConnectButton` account panel without registering another adapter
or wiring a second store. Recent activity is filtered by wallet, party and
network. The panel displays the actual connected network and explains how to
change accounts/networks in the wallet; a mismatch shows recovery guidance.
CIP-0103 does not define a universal set-primary-account or switch-network call,
so the UI does not issue a fabricated method. Reconnect wallets that do not
notify the application of account/network changes.

`useRecentTransactions()` reads the shared current-identity journal.
`RecentTransactions transactions={records}` renders it in a custom composition.
The panel shows up to five entries; the shared store keeps at most 100 total,
and the public current-identity view returns at most twenty. Flow hooks in the
same provider share those records and can reconcile the same current-identity id.
Without a shared provider, a flow retains its local fallback history.

The default remains memory-only. No journal is sent to telemetry. Existing
submission hooks, direct SDK calls and external writes are not automatically
enrolled. Full historical activity still comes from an authorized backend/indexer.

## Optional pending journal and reload recovery

The journal and ready-reader additions require SDK 0.21.0 / React 3.2.0 or later.
During rollout, check npm availability before importing the new exports. The
existing memory-only flow and application confirmation callback remain compatible.

The persistence implementation is a separate import from the **same React
package**, not another wallet package. Supply a stable journal to the kit:

```tsx
import { useEffect, useState } from 'react';
import { PartyLayerKit } from '@partylayer/react';
import { createTransactionJournal } from '@partylayer/react/journal';
import type { TransactionJournal } from '@partylayer/react/journal';

export function Providers({ children }: { children: React.ReactNode }) {
  const [journal, setJournal] = useState<TransactionJournal>();
  useEffect(() => {
    try {
      setJournal(createTransactionJournal({
        namespace: 'my-app:devnet', storage: window.localStorage,
        onError: () => { /* Show a storage warning if your app needs one. */ },
      }));
    } catch { /* Storage can be unavailable; the default remains in memory. */ }
  }, []);
  return <PartyLayerKit network="devnet" appName="My app" transactionJournal={journal}>
    {children}
  </PartyLayerKit>;
}
```

Only pending metadata is saved: local id, wallet, party, network, timestamps,
original command id and any real receipt update id. No command payload, signature,
credentials or error text is saved. Records older than seven days are not retained;
the journal is bounded to 100 entries. Terminal entries are removed from storage.

After reload every restored entry is `unknown` with `restored: true`. Nothing is
automatically resubmitted or confirmed. Offer an explicit **Check ledger status**
action calling `reconcile(id)` with a read-only confirmer. `useClearRecentTransactions()`
clears the provider history and journal, for example on app sign-out. Different apps
and environments must use different namespaces. Records are displayed/reconciled
only under their matching wallet/party/network.

Browser storage can be edited by the user or compromised application code.
Restored ids are lookup hints, not trusted business intent, financial authorization
or proof that the user originally requested an operation. A server must correlate
its own authenticated intent records before making business decisions. Storage
denial/quota errors cannot retry or undo an already-issued wallet request.

## Ready wallet proxy confirmation

For a compatible wallet exposing `ledgerApi`, pass
`createWalletLedgerReader(client, { networkId }).confirmTransaction` as `confirm`.
No holding interface is required for confirmation-only use. Capture the original
command id before submission and provide the same value in the command payload and
`submitTransaction({ signedTx: payload }, { commandId: payload.commandId })`.
The reader never infers that id from the wallet receipt. See the
[wire contract and limitations](./wallet-ledger-reader.md).

## Transfers, swaps and holdings

A login/message signature proves neither a send nor a swap. Acceptance requires
a valid operation, supported wallet/network, any required preapproval/acceptance
and the actual ledger outcome. PartyLayer forwards the wallet request and keeps
its outcome honest; the dApp/protocol owns the operation's business rules.

Holdings are private Canton contract data, not a universal public ETH-style
balance endpoint. Use the typed `useTokenHoldings` query with an authorized
application read fetcher or a supported wallet ledger proxy. Keep amounts as
decimal strings, include both instrument admin and id, distinguish locked and
available holdings, and key the read by party and network. See
[Wallet balances](https://partylayer.xyz/docs/wallet-balances) and
[Token transfers](https://partylayer.xyz/docs/token-transfers).

The automated transaction fixtures validate lifecycle/retry/account isolation.
Final live sends and protocol-specific swaps remain a separate wallet acceptance
stage; no mocked confirmation is recorded as a real ledger transaction.
