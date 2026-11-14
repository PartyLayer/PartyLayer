'use client';

import { useId, useState } from 'react';
import type { TokenInstrumentId, TransferIntent } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useTheme } from './theme';
import { useOperationLocale } from './operation-messages';
import { useReviewedTransaction, type UseReviewedTransactionParameters } from './use-reviewed-transaction';
import { OperationStatus, type OperationOutcome } from './operation-status';

export interface TransferFormProps extends UseReviewedTransactionParameters<TransferIntent> {
  instrumentId: TokenInstrumentId;
  /** Human-readable label, always displayed alongside the actual issuer. */
  tokenName?: string;
  outcome?: OperationOutcome | null;
}

/** Configured command route using the existing connected-wallet submission path. */
export function TransferForm({ instrumentId, tokenName, outcome, ...parameters }: TransferFormProps) {
  const theme = useTheme();
  const { session } = usePartyLayerContext();
  const { locale, direction, t, operationText: text } = useOperationLocale();
  const operation = useReviewedTransaction(parameters);
  const id = useId();
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [invalid, setInvalid] = useState(false);
  const reviewed = operation.review?.input;
  const unresolved = operation.transaction && ['submitted', 'unknown', 'awaitingApproval'].includes(operation.transaction.status);
  const busy = operation.preparing || operation.isPending;
  const button = { padding: '12px 16px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius,
    background: theme.colors.primary, color: theme.colors.primaryForeground, font: 'inherit', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' } as const;
  const input = { width: '100%', boxSizing: 'border-box', padding: '12px', marginTop: '6px',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius, background: theme.colors.background,
    color: theme.colors.text, font: 'inherit' } as const;
  const asset = reviewed?.instrumentId ?? instrumentId;
  async function review() {
    const valid = receiver.trim() === receiver && receiver.length > 0 && receiver.length <= 2048 && !/\p{Cc}/u.test(receiver) &&
      /^(?:0|[1-9]\d{0,27})(?:\.\d{1,10})?$/.test(amount) && /[1-9]/.test(amount) &&
      instrumentId.admin.trim() && instrumentId.id.trim();
    setInvalid(!valid);
    if (!valid) return;
    try { await operation.prepare({ receiver, amount, instrumentId }); } catch { /* The hook exposes the failure. */ }
  }
  return <section lang={locale} dir={direction} aria-labelledby={`${id}-title`}
    style={{ padding: 24, maxWidth: 480, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius,
      color: theme.colors.text, background: theme.colors.surface, fontFamily: theme.fontFamily }}>
    <h2 id={`${id}-title`} style={{ marginTop: 0 }}>{text('sendTokens')}</h2>
    <div style={{ marginBottom: 20 }}><strong><bdi>{tokenName ?? asset.id}</bdi></strong>
      <div style={{ fontSize: 12, overflowWrap: 'anywhere', color: theme.colors.textSecondary }}>{text('issuer')}: <bdi>{asset.admin}</bdi></div>
      <div style={{ fontSize: 12 }}>{t('accountNetwork', { network: parameters.networkId })}</div>
    </div>
    {reviewed ? <dl style={{ overflowWrap: 'anywhere' }}>
      <dt>{text('fromAccount')}</dt><dd style={{ marginInlineStart: 0, marginBottom: 12 }}><bdi>{session?.partyId}</bdi></dd>
      <dt>{text('recipient')}</dt><dd style={{ marginInlineStart: 0, marginBottom: 12 }}><bdi>{reviewed.receiver}</bdi></dd>
      <dt>{text('amount')}</dt><dd style={{ marginInlineStart: 0, fontSize: 24 }}><bdi>{reviewed.amount} {reviewed.instrumentId.id}</bdi></dd>
    </dl> : <form onSubmit={event => { event.preventDefault(); void review(); }}>
      <fieldset disabled={busy || !operation.supported || Boolean(unresolved)} style={{ border: 0, padding: 0, margin: 0 }}>
        <label htmlFor={`${id}-recipient`} style={{ display: 'block', marginBottom: 16 }}>{text('recipient')}
          <input id={`${id}-recipient`} value={receiver} maxLength={2048} autoComplete="off" spellCheck={false} dir="ltr"
            onChange={event => { setReceiver(event.target.value); setInvalid(false); }} style={input} required aria-invalid={invalid} />
        </label>
        <label htmlFor={`${id}-amount`} style={{ display: 'block', marginBottom: 20 }}>{text('amount')}
          <input id={`${id}-amount`} value={amount} maxLength={39} autoComplete="off" inputMode="decimal" dir="ltr"
            onChange={event => { setAmount(event.target.value); setInvalid(false); }} style={input} required aria-invalid={invalid} />
        </label>
        {operation.supported && !unresolved && <button type="submit" style={button}>{text('reviewTransfer')}</button>}
      </fieldset>
    </form>}
    {operation.preparing && <p role="status">{text('preparingTransfer')}</p>}
    {!operation.supported && <p role="status">{text('transferUnavailable')}</p>}
    {invalid && <p role="alert">{text('invalidTransfer')}</p>}
    {operation.error && <p role="alert" style={{ color: theme.colors.error, overflowWrap: 'anywhere' }}><bdi>{operation.error.message}</bdi></p>}
    {reviewed && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" style={button} disabled={busy} onClick={() => { void operation.submit().catch(() => {}); }}>{text('approveTransfer')}</button>
      <button type="button" disabled={busy} style={{ ...button, background: theme.colors.background, color: theme.colors.text }} onClick={operation.discard}>{text('editTransfer')}</button>
    </div>}
    <OperationStatus transaction={operation.transaction} outcome={outcome} />
    {unresolved && parameters.confirm && <button type="button" disabled={busy} style={button}
      onClick={() => { if (operation.transaction) void operation.reconcile(operation.transaction.id).catch(() => {}); }}>{text('refreshStatus')}</button>}
    <div style={{ fontSize: 11, marginTop: 20, color: theme.colors.textSecondary }}>{t('poweredBy')} <a href="https://partylayer.xyz" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>PartyLayer</a></div>
  </section>;
}
