/**
 * Incoming section. Reads the current party's pending transfer instructions with
 * the typed useTransferInstructions hook, and completes them with
 * useTransferInstructionAction (accept / reject). Accept and Reject render ONLY
 * when the instruction is in the pendingReceiverAcceptance state, matching the
 * spec (those choices are unavailable in the internal-workflow state). On success
 * it invalidates holdings and instructions so both sides refresh.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransferInstructions, useTransferInstructionAction } from '@partylayer/react/query';
import { PartyAvatar, TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateHoldingsAndReads } from '../lib/invalidate';
import { formatAmount } from '../lib/format';

export function Incoming() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();
  const [actingCid, setActingCid] = useState<string | null>(null);

  const q = useTransferInstructions({
    read: (signal) => backend.readIncoming(party, signal),
    key: partyKey('incoming', party),
  });

  const action = useTransferInstructionAction<{ ok: true }>({
    submit: (request, signal) => backend.submitTransferAction(request, signal),
    mutation: {
      onSuccess: () => invalidateHoldingsAndReads(queryClient),
    },
  });

  const act = (instructionCid: string, kind: 'accept' | 'reject') => {
    setActingCid(instructionCid);
    action.submitAction({ instructionCid, action: kind });
  };

  return (
    <Card title="Incoming" hint="useTransferInstructions + useTransferInstructionAction">
      <AsyncView
        isPending={q.isPending}
        error={q.error}
        data={q.instructions}
        isEmpty={(items) => items.length === 0}
        empty="No pending incoming transfers."
      >
        {(items) => (
          <ul className="list">
            {items.map(({ cid, instruction }) => {
              const t = instruction.transfer;
              const acceptable = instruction.status.kind === 'pendingReceiverAcceptance';
              return (
                <li key={cid} className="row">
                  <PartyAvatar id={t.sender} size={28} />
                  <div className="row-main">
                    <div className="row-title">
                      {formatAmount(t.amount)} <span className="muted">{t.instrumentId.id}</span>
                    </div>
                    <div className="row-sub muted">
                      from {t.sender} · execute before {t.executeBefore.slice(0, 10)}
                      {t.meta?.memo ? ' · ' + t.meta.memo : ''}
                    </div>
                    {!acceptable ? (
                      <div className="row-sub muted">
                        pending internal workflow
                        {instruction.status.kind === 'pendingInternalWorkflow'
                          ? ' · waiting on ' + Object.keys(instruction.status.pendingActions).join(', ')
                          : ''}
                      </div>
                    ) : null}
                  </div>
                  {acceptable ? (
                    <div className="row-actions">
                      <button
                        className="btn btn-primary"
                        disabled={action.isPending}
                        onClick={() => act(cid, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={action.isPending}
                        onClick={() => act(cid, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>

      <TransactionToast
        status={toastStatus(action)}
        error={action.error}
        message={action.isSuccess ? 'Instruction ' + (actingCid ?? '') + ' completed.' : undefined}
      />
    </Card>
  );
}
