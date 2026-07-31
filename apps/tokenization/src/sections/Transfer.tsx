/**
 * Transfer section. Builds a standard TokenTransfer and submits it through
 * useTransferInstruction. Shows CostPreview before confirm and drives a
 * TransactionToast from the mutation state. On success it invalidates the holdings
 * and incoming query keys so both sides refresh.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransferInstruction, useTokenHoldings, type TokenTransfer } from '@partylayer/react/query';
import { CostPreview, TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, Field } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateHoldingsAndReads } from '../lib/invalidate';
import { PARTIES, PARTY_ORDER, INSTRUMENT, FEE_ESTIMATE } from '../lib/fixtures';
import { demoStore } from '../lib/store';
import { formatAmount, validateAmount, addAmount } from '../lib/format';
import type { DemoPartyKey } from '../lib/types';

export function Transfer() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();

  const others = PARTY_ORDER.filter((p) => p !== party);
  const [receiver, setReceiver] = useState<DemoPartyKey>(others[0]);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const mutation = useTransferInstruction<{ ok: true }>({
    submit: (transfer, signal) => backend.submitTransfer(transfer, signal),
    mutation: {
      onSuccess: () => {
        // Refresh every party's holdings and incoming so both sides update.
        invalidateHoldingsAndReads(queryClient);
        setAmount('');
        setMemo('');
      },
    },
  });

  // Keep the receiver valid when the acting party changes.
  const receiverKey = others.includes(receiver) ? receiver : others[0];

  // In live mode the instrument and the available balance come from the party's real
  // holdings, exactly as the Holdings section reads them, so the panel cannot say Amulet
  // on one card and DEMO on the next. Demo mode keeps the fixture instrument and balance.
  const isLive = import.meta.env.VITE_BACKEND === 'live';
  const holdingsQ = useTokenHoldings({
    read: (signal) => backend.readHoldings(party, signal),
    key: partyKey('holdings', party),
  });
  const holdings = holdingsQ.holdings ?? [];
  const unlocked = holdings.filter((r) => !r.holding.lock);
  const liveInstrument = holdings[0]?.holding.instrumentId;
  const instrument = isLive
    ? (liveInstrument ?? { admin: '', id: '' })
    : { admin: INSTRUMENT.admin, id: INSTRUMENT.id };
  const available = isLive
    ? unlocked.reduce((sum, r) => addAmount(sum, r.holding.amount), '0.00')
    : demoStore.balanceOf(party);
  // Validate the amount inline: numeric, greater than zero, within the available balance.
  // Live submissions send the party key (the gateway resolves it to the real party id, as
  // the reads do); a live transfer also needs the instrument loaded from holdings first.
  const liveNotReady = isLive && !liveInstrument;
  const amountReason = validateAmount(amount, available);
  const submitReason = liveNotReady ? 'Loading your holdings, one moment.' : amountReason;
  const valid = !submitReason;

  const onConfirm = () => {
    const now = new Date();
    const transfer: TokenTransfer = {
      sender: isLive ? party : PARTIES[party].partyId,
      receiver: isLive ? receiverKey : PARTIES[receiverKey].partyId,
      amount,
      instrumentId: { admin: instrument.admin, id: instrument.id },
      requestedAt: now.toISOString(),
      executeBefore: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      inputHoldingCids: isLive ? [] : demoStore.unlockedCids(party),
      meta: memo ? { memo } : {},
    };
    mutation.submitTransfer(transfer);
  };

  return (
    <Card title="Transfer" hint="useTransferInstruction">
      <div className="muted balance-line">
        Available to send: <strong>{formatAmount(available)}</strong> {instrument.id}
      </div>

      <div className="form-grid">
        <Field label="Receiver">
          <select value={receiverKey} onChange={(e) => setReceiver(e.target.value as DemoPartyKey)}>
            {others.map((p) => (
              <option key={p} value={p}>
                {PARTIES[p].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={instrument.id ? 'Amount (' + instrument.id + ')' : 'Amount'}>
          <div className="input-max">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amount.trim() !== '' && amountReason != null}
            />
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setAmount(available)}
              disabled={validateAmount(available) !== null}
              title="Use the full available balance"
            >
              Max
            </button>
          </div>
          {amount.trim() !== '' && amountReason ? (
            <span className="field-error" role="alert">
              {amountReason}
            </span>
          ) : null}
        </Field>
        <Field label="Memo (optional)">
          <input value={memo} placeholder="what is it for" onChange={(e) => setMemo(e.target.value)} />
        </Field>
      </div>

      <div className="review">
        {valid ? (
          <>
            <div className="review-line">
              Send <strong>{formatAmount(amount)}</strong> {instrument.id} to{' '}
              <strong>{PARTIES[receiverKey].label}</strong>
            </div>
            <CostPreview estimate={FEE_ESTIMATE} />
          </>
        ) : null}
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={!valid || mutation.isPending}
        >
          {mutation.isPending ? 'Submitting...' : 'Confirm transfer'}
        </button>
        {!valid ? <span className="field-error">{submitReason}</span> : null}
      </div>

      <TransactionToast
        status={toastStatus(mutation)}
        error={mutation.error}
        message={mutation.isSuccess ? 'Transfer sent. The receiver can now accept it.' : undefined}
      />
    </Card>
  );
}
