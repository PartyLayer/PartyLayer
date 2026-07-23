/**
 * MyAllocations section. Exercises useTokenAllocations (party-scoped read) and
 * useAllocationAction with the withdraw action. Shows each allocation's settlement
 * ref, leg summary, and backing holding cids, with a Withdraw button (allowed before
 * allocateBefore; the store enforces the guard).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useTokenAllocations, useAllocationAction } from '@partylayer/react/query';
import { TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView, Badge } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateAll } from '../lib/invalidate';
import { formatAmount } from '../lib/format';

export function MyAllocations() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();

  const q = useTokenAllocations({
    read: (signal) => backend.readAllocations(party, signal),
    key: partyKey('allocations', party),
  });

  const action = useAllocationAction<{ ok: true }>({
    submit: (request, signal) => backend.submitAllocationAction(request, signal),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });

  return (
    <Card title="My allocations" hint="useTokenAllocations + useAllocationAction">
      <AsyncView
        isPending={q.isPending}
        error={q.error}
        data={q.allocations}
        isEmpty={(refs) => refs.length === 0}
        empty="No allocations yet. Allocate a leg from Trades."
      >
        {(refs) => (
          <ul className="list">
            {refs.map(({ cid, allocation: a }) => {
              const leg = a.allocation.transferLeg;
              const settle = a.allocation.settlement;
              return (
                <li key={cid} className="row row-block">
                  <div className="row-main">
                    <div className="row-title">
                      {formatAmount(leg.amount)} <span className="muted">{leg.instrumentId.id}</span>{' '}
                      <Badge tone="ok">leg {a.allocation.transferLegId}</Badge>
                    </div>
                    <div className="row-sub muted">
                      to {leg.receiver} · settlement {settle.settlementRef.id}
                    </div>
                    <div className="row-sub muted">backing {a.holdingCids.join(', ')}</div>
                  </div>
                  <div className="row-actions">
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={action.isPending}
                      onClick={() => action.submitAction({ allocationCid: cid, action: 'withdraw' })}
                    >
                      Withdraw
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>

      <TransactionToast
        status={toastStatus(action)}
        error={action.error}
        message={action.isSuccess ? 'Allocation withdrawn.' : undefined}
      />
    </Card>
  );
}
