'use client';

import { useCallback, useMemo } from 'react';
import { availableTokenTransferV2Actions, parseTokenAccount, toCAIP2Network, type TokenTransferInstructionV1Ref, type TokenTransferInstructionV2Ref } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useTheme } from './theme';
import { useOperationLocale } from './operation-messages';
import { useReviewedTransaction, type OperationPreparationContext, type PreparedOperation, type UseReviewedTransactionParameters } from './use-reviewed-transaction';
import { OperationStatus, type OperationOutcome } from './operation-status';

export type TransferInboxEntry = { standard: 'v1'; reference: TokenTransferInstructionV1Ref }
  | { standard: 'v2'; reference: TokenTransferInstructionV2Ref };
export type TransferInboxActionKind = 'accept' | 'reject' | 'withdraw';
export interface TransferInboxAction {
  entry: TransferInboxEntry;
  action: TransferInboxActionKind;
}
export interface TransferInboxSnapshot {
  walletId: string;
  partyId: string;
  networkId: string;
  entries: readonly TransferInboxEntry[];
}
export interface TransferInboxProps extends Omit<UseReviewedTransactionParameters<TransferInboxAction>, 'prepare'> {
  snapshot?: TransferInboxSnapshot;
  loading?: boolean;
  error?: Error | null;
  prepareAction?: (input: TransferInboxAction, context: OperationPreparationContext) => Promise<PreparedOperation>;
  outcomes?: readonly OperationOutcome[];
}

function validEntry(entry: TransferInboxEntry): boolean {
  const id = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 2048 && !/\p{Cc}/u.test(value);
  try {
    if (!entry || !['v1', 'v2'].includes(entry.standard) || !id(entry.reference?.cid)) return false;
    const { instruction } = entry.reference;
    const { transfer } = instruction;
    if (typeof transfer.amount !== 'string' || !/^(?:0|[1-9]\d{0,27})(?:\.\d{1,10})?$/.test(transfer.amount) ||
      !id(transfer.instrumentId?.admin) || !id(transfer.instrumentId?.id) ||
      typeof transfer.executeBefore !== 'string' || !Number.isFinite(Date.parse(transfer.executeBefore)) ||
      typeof transfer.requestedAt !== 'string' || !Number.isFinite(Date.parse(transfer.requestedAt)) ||
      !Array.isArray(transfer.inputHoldingCids) || !transfer.inputHoldingCids.every(id)) return false;
    if (entry.standard === 'v1') {
      if (!id(transfer.sender) || !id(transfer.receiver) ||
        !['pendingReceiverAcceptance', 'pendingInternalWorkflow'].includes(entry.reference.instruction.status?.kind)) return false;
    } else {
      parseTokenAccount(transfer.sender); parseTokenAccount(transfer.receiver);
      const actions = entry.reference.instruction.availableActions;
      if (!Array.isArray(actions) || actions.some(pair => !Array.isArray(pair) || pair.length !== 2 ||
        !pair[0] || !['TIA_Accept', 'TIA_Reject', 'TIA_Withdraw', 'TIA_Custom'].includes(pair[0].tag) ||
        !Array.isArray(pair[1]) || pair[1].some(group => !Array.isArray(group) || !group.every(id)))) return false;
    }
    // Snapshots originate as JSON. Cycles or an excessive payload must not
    // crash a render or preserve a stale actionable review.
    return JSON.stringify(entry).length <= 256_000;
  } catch { return false; }
}

/** Eligibility hints only. The registry must validate current actors and context. */
export function getTransferInboxActions(entry: TransferInboxEntry, partyId: string, now = Date.now()): TransferInboxActionKind[] {
  if (!validEntry(entry)) return [];
  const { instruction } = entry.reference;
  const deadline = Date.parse(instruction.transfer.executeBefore);
  if (!partyId || !entry.reference.cid || !Number.isFinite(deadline)) return [];
  if (entry.standard === 'v2') {
    return availableTokenTransferV2Actions(entry.reference.instruction.availableActions, [partyId]).flatMap(action => {
      if (action.tag === 'TIA_Accept') return deadline > now ? ['accept' as const] : [];
      if (action.tag === 'TIA_Reject') return ['reject' as const];
      if (action.tag === 'TIA_Withdraw') return ['withdraw' as const];
      return [];
    });
  }
  const transfer = entry.reference.instruction.transfer;
  const actions: TransferInboxActionKind[] = [];
  if (transfer.receiver === partyId && entry.reference.instruction.status.kind === 'pendingReceiverAcceptance') {
    if (deadline > now) actions.push('accept');
    actions.push('reject');
  }
  if (transfer.sender === partyId) actions.push('withdraw');
  return actions;
}

export function TransferInbox({ snapshot, loading, error, ...parameters }: TransferInboxProps) {
  const { session } = usePartyLayerContext();
  const { locale, direction, t, operationText: text } = useOperationLocale();
  const theme = useTheme();
  const current = session && !session.networkMismatch && snapshot?.walletId === String(session.walletId) &&
    snapshot.partyId === String(session.partyId) && snapshot.networkId === parameters.networkId &&
    toCAIP2Network(session.network).networkId === parameters.networkId;
  const entries = current && Array.isArray(snapshot.entries) ? snapshot.entries : [];
  const invalid = Boolean(current && !Array.isArray(snapshot.entries)) || entries.length > 1000 || entries.some(entry => !validEntry(entry));
  const duplicate = !invalid && new Set(entries.map(entry => entry.reference.cid)).size !== entries.length;
  return <section lang={locale} dir={direction} aria-label={text('incomingTransfers')}
    style={{ fontFamily: theme.fontFamily, color: theme.colors.text }}>
    <h2>{text('incomingTransfers')}</h2>
    {loading ? <p role="status">{t('loadingBalances')}</p> : error || duplicate || invalid ? <p role="alert">{error?.message ?? t('unknownError')}</p>
      : !entries.length ? <p>{text('noIncomingTransfers')}</p>
      : entries.map(entry => <InboxItem key={JSON.stringify([snapshot!.walletId, snapshot!.partyId, snapshot!.networkId, entry])}
        entry={entry} partyId={snapshot!.partyId} {...parameters} />)}
  </section>;
}

function InboxItem({ entry, partyId, prepareAction, outcomes, ...parameters }: Pick<TransferInboxProps, 'prepareAction' | 'networkId' | 'confirm' | 'preparationTimeoutMs' | 'confirmationTimeoutMs' | 'outcomes'> & { entry: TransferInboxEntry; partyId: string }) {
  const serialized = JSON.stringify(entry);
  const stableEntry: TransferInboxEntry = useMemo(() => JSON.parse(serialized), [serialized]);
  const prepare = useCallback(async (input: TransferInboxAction, context: OperationPreparationContext) => {
    if (!prepareAction || input.entry.reference.cid !== stableEntry.reference.cid ||
      !getTransferInboxActions(stableEntry, context.partyId).includes(input.action)) throw new Error('This transfer action is no longer available');
    const prepared = await prepareAction(input, context);
    // An acceptance must not outlive the transfer deadline while the user reviews it.
    return input.action === 'accept' ? { ...prepared, expiresAt: Math.min(prepared.expiresAt, Date.parse(stableEntry.reference.instruction.transfer.executeBefore)) } : prepared;
  }, [prepareAction, stableEntry]);
  const operation = useReviewedTransaction({ ...parameters, prepare: prepareAction ? prepare : undefined });
  const { operationText: text, t } = useOperationLocale();
  const theme = useTheme();
  const transfer = stableEntry.reference.instruction.transfer;
  const accountDetails = (account: typeof transfer.sender) => typeof account === 'string' ? <bdi>{account}</bdi> : <>
    {account.owner && <bdi>{account.owner}</bdi>}
    <span style={{ display: 'block', fontSize: 12 }}><bdi>{account.id ? t('account', { party: account.id }) : t('defaultAccount')}</bdi></span>
    {account.provider && <span style={{ display: 'block', fontSize: 12 }}><bdi>{t('accountProvider', { provider: account.provider })}</bdi></span>}
  </>;
  const actions = getTransferInboxActions(stableEntry, partyId);
  const actionLabel = (action: TransferInboxActionKind) => text(action === 'accept' ? 'acceptTransfer' : action === 'reject' ? 'rejectTransfer' : 'withdrawTransfer');
  const unresolved = operation.transaction && ['submitted', 'unknown', 'awaitingApproval'].includes(operation.transaction.status);
  const busy = operation.preparing || operation.isPending;
  const button = { padding: '12px 16px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius,
    color: theme.colors.text, background: theme.colors.background, font: 'inherit', cursor: 'pointer' } as const;
  return <article style={{ padding: 20, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius, marginBottom: 12, background: theme.colors.surface, overflowWrap: 'anywhere' }}>
    <strong><bdi>{transfer.amount} {transfer.instrumentId.id}</bdi></strong>
    <p style={{ fontSize: 12 }}>{text('issuer')}: <bdi>{transfer.instrumentId.admin}</bdi></p>
    <p>{text('fromAccount')}: {accountDetails(transfer.sender)}</p><p>{text('toAccount')}: {accountDetails(transfer.receiver)}</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {operation.review ? <>
        <p style={{ flexBasis: '100%', margin: 0 }}>{text('reviewAction')}: <strong>{actionLabel(operation.review.input.action)}</strong></p>
        <button type="button" disabled={busy} style={{ ...button, background: theme.colors.primary, color: theme.colors.primaryForeground }} onClick={() => { void operation.submit().catch(() => {}); }}>{text('approveTransfer')}</button>
        <button type="button" disabled={busy} style={button} onClick={operation.discard}>{t('cancel')}</button>
      </> : operation.supported && !unresolved && (!operation.transaction || ['failed', 'rejected'].includes(operation.transaction.status)) ? actions.map(action =>
        <button type="button" key={action} disabled={busy} style={button} onClick={() => { void operation.prepare({ entry: stableEntry, action }).catch(() => {}); }}>{actionLabel(action)}</button>,
      ) : null}
    </div>
    {operation.preparing && <p role="status">{text('preparingTransfer')}</p>}
    {!actions.length && !operation.transaction && <p>{text('pendingWorkflow')}</p>}
    {operation.error && <p role="alert">{operation.error.message}</p>}
    <OperationStatus transaction={operation.transaction} outcome={outcomes?.find(outcome => outcome.commandId === operation.transaction?.commandId)} />
    {unresolved && parameters.confirm && <button type="button" disabled={busy} style={button} onClick={() => { if (operation.transaction) void operation.reconcile(operation.transaction.id).catch(() => {}); }}>{text('refreshStatus')}</button>}
  </article>;
}
