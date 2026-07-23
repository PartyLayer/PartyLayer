/**
 * Allocations section. Exercises the remaining three CIP-0056 hooks:
 *  - useTokenAllocations reads the funded-allocation list (typed view),
 *  - useAllocationInstruction creates an allocation via the factory,
 *  - useAllocationAction acts on a funded allocation (executeTransfer/cancel/withdraw).
 * The demo backend returns fixture results for the writes; a real dApp performs the
 * registry-specific factory/context flow inside these fetchers (see the README).
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  useTokenAllocations,
  useAllocationInstruction,
  useAllocationAction,
  type AllocationActionKind,
} from '@partylayer/react/query';
import { TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView, Badge } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateAllocations } from '../lib/invalidate';
import { formatAmount } from '../lib/format';
import { PARTIES } from '../lib/fixtures';

const ACTIONS: { kind: AllocationActionKind; label: string }[] = [
  { kind: 'executeTransfer', label: 'Execute' },
  { kind: 'cancel', label: 'Cancel' },
  { kind: 'withdraw', label: 'Withdraw' },
];

export function Allocations() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();

  const q = useTokenAllocations({
    read: (signal) => backend.readAllocations(signal),
    key: partyKey('allocations', party),
  });

  const create = useAllocationInstruction<{ ok: true }>({
    submit: (request, signal) => backend.submitAllocation(request, signal),
    mutation: {
      onSuccess: () => invalidateAllocations(queryClient),
    },
  });

  const act = useAllocationAction<{ ok: true }>({
    submit: (request, signal) => backend.submitAllocationAction(request, signal),
    mutation: {
      onSuccess: () => invalidateAllocations(queryClient),
    },
  });

  const createDemoAllocation = () => {
    // Build the standard AllocationFactory_Allocate request from the issuer as admin.
    create.submitAllocation({
      expectedAdmin: PARTIES.issuer.partyId,
      allocation: {
        settlement: {
          executor: PARTIES.issuer.partyId,
          settlementRef: { id: 'settlement-demo-new' },
          requestedAt: new Date().toISOString(),
          allocateBefore: '2027-01-01T00:00:00Z',
          settleBefore: '2027-01-01T00:00:00Z',
        },
        transferLegId: 'leg-new',
        transferLeg: {
          sender: PARTIES[party].partyId,
          receiver: PARTIES.bob.partyId,
          amount: '5.00',
          instrumentId: { admin: PARTIES.issuer.partyId, id: 'DEMO' },
        },
      },
      requestedAt: new Date().toISOString(),
      inputHoldingCids: [],
      meta: { demo: 'true' },
    });
  };

  const busy = create.isPending || act.isPending;

  return (
    <Card title="Allocations" hint="useTokenAllocations + useAllocationInstruction + useAllocationAction">
      <div className="alloc-head">
        <span className="muted">Funded allocations for a settlement leg.</span>
        <button className="btn btn-ghost" onClick={createDemoAllocation} disabled={busy}>
          Create demo allocation
        </button>
      </div>

      <AsyncView
        isPending={q.isPending}
        error={q.error}
        data={q.allocations}
        isEmpty={(a) => a.length === 0}
        empty="No allocations."
      >
        {(allocations) => (
          <ul className="list">
            {allocations.map((a, i) => {
              const leg = a.allocation.transferLeg;
              const settle = a.allocation.settlement;
              return (
                <li key={i} className="row row-block">
                  <div className="row-main">
                    <div className="row-title">
                      {formatAmount(leg.amount)} <span className="muted">{leg.instrumentId.id}</span>{' '}
                      <Badge tone="neutral">leg {a.allocation.transferLegId}</Badge>
                    </div>
                    <div className="row-sub muted">
                      {leg.sender} to {leg.receiver}
                    </div>
                    <div className="row-sub muted">
                      executor {settle.executor} · settle before {settle.settleBefore.slice(0, 10)} ·{' '}
                      {a.holdingCids.length} holding{a.holdingCids.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="row-actions">
                    {ACTIONS.map((action) => (
                      <button
                        key={action.kind}
                        className="btn btn-ghost btn-small"
                        disabled={busy}
                        onClick={() =>
                          // The AllocationView carries no cid (same as holdings), so a real
                          // dApp tracks it from the ACS query; the demo uses a stable id.
                          act.submitAction({ allocationCid: 'alloc-cid-' + (i + 1), action: action.kind })
                        }
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>

      <TransactionToast
        status={toastStatus(create.isPending || create.isSuccess || create.isError ? create : act)}
        error={create.error ?? act.error}
        message={
          create.isSuccess
            ? 'Allocation created.'
            : act.isSuccess
              ? 'Allocation action submitted.'
              : undefined
        }
      />
    </Card>
  );
}
