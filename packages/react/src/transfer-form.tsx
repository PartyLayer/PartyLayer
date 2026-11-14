'use client';

import { useId, useState } from 'react';
import type { TokenInstrumentId, TransferIntent } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useTheme } from './theme';
import { useOperationLocale } from './operation-messages';
import { useReviewedTransaction, type UseReviewedTransactionParameters } from './use-reviewed-transaction';
import { OperationStatus, type OperationOutcome } from './operation-status';
import { operationUI, OperationIcon } from './operation-ui';

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
  const ui = operationUI(theme);
  const button = { ...ui.button, ...ui.primary, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 };
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
    style={ui.card}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, background: theme.colors.surface }}><OperationIcon kind="send" /></span>
      <h2 id={`${id}-title`} style={ui.heading}>{text('sendTokens')}</h2>
    </header>
    <div style={{ padding: 16, marginBottom: 24, border: `1px solid ${theme.colors.border}`, borderRadius: 14, background: theme.colors.surface, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, minWidth: 0 }}>
        <span aria-hidden="true" style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', background: theme.colors.primary, color: theme.colors.primaryForeground ?? theme.colors.text, fontSize: 14, fontWeight: 700 }}>{Array.from(asset.id)[0]}</span>
        <strong style={{ fontSize: 15, minWidth: 0 }}><bdi>{tokenName ?? asset.id}</bdi></strong>
      </div>
      <div style={{ ...ui.mono, color: theme.colors.textSecondary }}>{text('issuer')}: <bdi>{asset.admin}</bdi></div>
      <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>{t('accountNetwork', { network: parameters.networkId })}</div>
    </div>
    {reviewed ? <dl style={{ margin: '0 0 24px', minWidth: 0 }}>
      <div style={ui.row}><dt style={{ color: theme.colors.textSecondary }}>{text('fromAccount')}</dt><dd style={{ ...ui.mono, margin: 0, maxWidth: '100%' }}><bdi>{session?.partyId}</bdi></dd></div>
      <div style={ui.row}><dt style={{ color: theme.colors.textSecondary }}>{text('recipient')}</dt><dd style={{ ...ui.mono, margin: 0, maxWidth: '100%' }}><bdi>{reviewed.receiver}</bdi></dd></div>
      <div style={{ paddingTop: 20 }}><dt style={ui.label}>{text('amount')}</dt><dd style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 650, letterSpacing: '-.025em', overflowWrap: 'anywhere' }}><bdi>{reviewed.amount} {reviewed.instrumentId.id}</bdi></dd></div>
    </dl> : <form onSubmit={event => { event.preventDefault(); void review(); }}>
      <fieldset disabled={busy || !operation.supported || Boolean(unresolved)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <label htmlFor={`${id}-recipient`} style={{ ...ui.label, marginBottom: 20 }}>{text('recipient')}
          <input id={`${id}-recipient`} value={receiver} maxLength={2048} autoComplete="off" spellCheck={false} dir="ltr"
            placeholder="party::…" onChange={event => { setReceiver(event.target.value); setInvalid(false); }} style={{ ...ui.input, marginTop: 8, fontFamily: ui.mono.fontFamily }} required aria-invalid={invalid} />
        </label>
        <label htmlFor={`${id}-amount`} style={{ ...ui.label, marginBottom: 24 }}>{text('amount')}
          <input id={`${id}-amount`} value={amount} maxLength={39} autoComplete="off" inputMode="decimal" dir="ltr"
            placeholder="0.00" onChange={event => { setAmount(event.target.value); setInvalid(false); }} style={{ ...ui.input, marginTop: 8, minHeight: 64, fontSize: 26, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }} required aria-invalid={invalid} />
        </label>
        {operation.supported && !unresolved && <button type="submit" style={{ ...button, width: '100%' }}>{text('reviewTransfer')}</button>}
      </fieldset>
    </form>}
    {operation.preparing && <p role="status">{text('preparingTransfer')}</p>}
    {!operation.supported && <p role="status">{text('transferUnavailable')}</p>}
    {invalid && <p role="alert">{text('invalidTransfer')}</p>}
    {operation.error && <p role="alert" style={{ color: theme.colors.error, overflowWrap: 'anywhere' }}><bdi>{operation.error.message}</bdi></p>}
    {reviewed && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <button type="button" style={{ ...button, flex: '1 1 180px' }} disabled={busy} onClick={() => { void operation.submit().catch(() => {}); }}>{text('approveTransfer')}</button>
      <button type="button" disabled={busy} style={{ ...ui.button, flex: '1 1 140px' }} onClick={operation.discard}>{text('editTransfer')}</button>
    </div>}
    <OperationStatus transaction={operation.transaction} outcome={outcome} />
    {unresolved && parameters.confirm && <button type="button" disabled={busy} style={button}
      onClick={() => { if (operation.transaction) void operation.reconcile(operation.transaction.id).catch(() => {}); }}>{text('refreshStatus')}</button>}
    <div style={{ fontSize: 11, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${theme.colors.border}`, color: theme.colors.textSecondary, textAlign: 'center' }}>{t('poweredBy')} <a href="https://partylayer.xyz" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>PartyLayer</a></div>
  </section>;
}
