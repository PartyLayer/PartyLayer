/**
 * Incoming section. Reads the current party's pending transfer instructions with
 * the generic useDamlContract (there is no typed instruction-view hook, so the dApp
 * supplies an app-level view model), and completes them with
 * useTransferInstructionAction (accept / reject). On success it invalidates holdings
 * and incoming so both sides refresh.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDamlContract, useTransferInstructionAction } from '@partylayer/react/query';
import { PartyAvatar, TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateHoldingsAndReads } from '../lib/invalidate';
import { formatAmount } from '../lib/format';
import type { IncomingTransfer } from '../lib/types';

export function Incoming() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();
  const [actingCid, setActingCid] = useState<string | null>(null);

  const q = useDamlContract<IncomingTransfer[]>({
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
    <Card title="Incoming" hint="useDamlContract + useTransferInstructionAction">
      <AsyncView
        isPending={q.isPending}
        error={q.error}
        data={q.contract}
        isEmpty={(items) => items.length === 0}
        empty="No pending incoming transfers."
      >
        {(items) => (
          <ul className="list">
            {items.map((item) => (
              <li key={item.instructionCid} className="row">
                <PartyAvatar id={item.transfer.sender} size={28} />
                <div className="row-main">
                  <div className="row-title">
                    {formatAmount(item.transfer.amount)}{' '}
                    <span className="muted">{item.transfer.instrumentId.id}</span>
                  </div>
                  <div className="row-sub muted">
                    from {item.transfer.sender} · execute before{' '}
                    {item.transfer.executeBefore.slice(0, 10)}
                    {item.transfer.meta?.memo ? ' · ' + item.transfer.meta.memo : ''}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="btn btn-primary"
                    disabled={action.isPending}
                    onClick={() => act(item.instructionCid, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={action.isPending}
                    onClick={() => act(item.instructionCid, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
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
