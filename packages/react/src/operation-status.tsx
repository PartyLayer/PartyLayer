'use client';

import type { TransactionFlowRecord } from './use-transaction-flow';
import { TransactionToast } from './transaction-toast';
import { useOperationLocale } from './operation-messages';
import { useTheme } from './theme';

export interface OperationOutcome {
  /** Authoritative application/registry source. Not a browser success callback. */
  sourceId: string;
  walletId: string;
  partyId: string;
  networkId: string;
  commandId: string;
  updateId: string;
  status: 'pendingReceiverAcceptance' | 'pendingWorkflow' | 'completed' | 'failed';
}

/** A ledger-inclusion result alone is never presented as a completed transfer/swap. */
export function OperationStatus({ transaction, outcome }: { transaction: TransactionFlowRecord | null; outcome?: OperationOutcome | null }) {
  const { operationText } = useOperationLocale();
  const theme = useTheme();
  if (!transaction) return null;
  const bound = transaction.status === 'confirmed' && transaction.commandId && transaction.updateId && typeof outcome?.sourceId === 'string' && outcome.sourceId.trim() &&
    outcome.commandId === transaction.commandId && outcome.updateId === transaction.updateId &&
    outcome.walletId === transaction.walletId && outcome.partyId === transaction.partyId && outcome.networkId === transaction.networkId;
  const message = !bound ? 'unknownOutcome' : outcome.status === 'completed' ? 'completedTransfer'
    : outcome.status === 'failed' ? 'failedTransfer' : outcome.status === 'pendingReceiverAcceptance' ? 'pendingAcceptance' : 'pendingWorkflow';
  const failed = bound && outcome.status === 'failed';
  const completed = bound && outcome.status === 'completed';
  const color = failed ? theme.colors.error : completed ? theme.colors.success : theme.colors.warning;
  const background = failed ? theme.colors.errorBg : completed ? theme.colors.successBg : theme.colors.warningBg;
  const receipt = transaction.receipt && transaction.status === 'confirmed' && transaction.updateId
    ? { ...transaction.receipt, updateId: transaction.updateId } : transaction.receipt;
  return <div>
    <TransactionToast status={transaction.status} receipt={receipt} error={transaction.error} />
    {transaction.status === 'confirmed' && <p role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'}
      style={{ padding: '12px 16px', borderInlineStart: `3px solid ${color}`, borderRadius: theme.borderRadius, color: theme.colors.text, background }}>
      <bdi dir="auto">{operationText(message)}</bdi>
    </p>}
    {transaction.status === 'confirmed' && transaction.updateId && !receipt && <code dir="ltr" style={{ overflowWrap: 'anywhere' }}>{transaction.updateId}</code>}
  </div>;
}
