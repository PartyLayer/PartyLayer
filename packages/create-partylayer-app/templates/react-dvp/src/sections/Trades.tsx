/**
 * Trades section (the DvP core). Role-aware over the same allocation requests.
 *
 * Counterparties (Alice, Bob) see the legs they send: each has an "Allocate my leg"
 * action (CostPreview then useAllocationInstruction) and a "Reject" action
 * (useAllocationRequestAction, action 'reject', actor = the current party).
 *
 * The venue sees a "New trade" form, per-leg allocation status (matched or missing
 * via the expected-spec comparator over the counterparties' allocations), an atomic
 * "Settle" (the generic useChoice; enabled only when every leg is matched), a
 * "Withdraw trade" (useAllocationRequestAction, action 'withdraw'), and a per-matched
 * -leg "Cancel allocation" (useAllocationAction, action 'cancel') for the abort path.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllocationRequests,
  useTokenAllocations,
  useAllocationInstruction,
  useAllocationAction,
  useAllocationRequestAction,
  useChoice,
  type AllocationInstructionRequest,
} from '@partylayer/react/query';
import { CostPreview, TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView, Badge, Field } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateAll } from '../lib/invalidate';
import { allocationForLeg, matchedLegIds } from '../lib/match';
import { formatAmount, isPositiveAmount } from '../lib/format';
import { PARTIES, REGISTRY, FEE_ESTIMATE } from '../lib/fixtures';
import { demoStore } from '../lib/store';
import type { SettleTrade, CreateTrade } from '../lib/types';

export function Trades() {
  const { party } = useDemo();
  return party === 'venue' ? <VenueTrades /> : <CounterpartyTrades />;
}

function CounterpartyTrades() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();
  const me = PARTIES[party].partyId;
  const [allocating, setAllocating] = useState<string | null>(null);

  const trades = useAllocationRequests({
    read: (signal) => backend.readTrades(signal),
    key: partyKey('trades', party),
  });

  const allocate = useAllocationInstruction<{ ok: true }>({
    submit: (request, signal) => backend.submitAllocation(request, signal),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });

  const reject = useAllocationRequestAction<{ ok: true }>({
    submit: (request, signal) => backend.submitRequestAction(request, signal),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });

  const doAllocate = (requestCid: string, legId: string) => {
    const trade = trades.requests?.find((t) => t.cid === requestCid);
    if (!trade) return;
    const leg = trade.request.transferLegs[legId];
    const request: AllocationInstructionRequest = {
      // SECURITY: expectedAdmin comes from a trusted source (here the registry
      // constant); the choice checks the factory's admin against it.
      expectedAdmin: REGISTRY,
      allocation: {
        settlement: trade.request.settlement,
        transferLegId: legId,
        transferLeg: leg,
      },
      requestedAt: new Date().toISOString(),
      inputHoldingCids: demoStore.unlockedCids(party, leg.instrumentId.admin, leg.instrumentId.id),
      meta: {},
    };
    setAllocating(requestCid + ':' + legId);
    allocate.submitAllocation(request);
  };

  return (
    <Card title="Trades" hint="useAllocationRequests + useAllocationInstruction + useAllocationRequestAction">
      <AsyncView
        isPending={trades.isPending}
        error={trades.error}
        data={trades.requests}
        isEmpty={(items) => items.length === 0}
        empty="No open trades."
      >
        {(items) => (
          <ul className="list">
            {items.map((trade) => {
              const myLegs = Object.entries(trade.request.transferLegs).filter(
                ([, leg]) => leg.sender === me,
              );
              return (
                <li key={trade.cid} className="row row-block">
                  <div className="row-main">
                    <div className="row-title">
                      Trade {trade.request.settlement.settlementRef.id}{' '}
                      <span className="muted">executor {trade.request.settlement.executor}</span>
                    </div>
                    {Object.entries(trade.request.transferLegs).map(([legId, leg]) => (
                      <div key={legId} className="row-sub muted">
                        {legId}: {formatAmount(leg.amount)} {leg.instrumentId.id} from {leg.sender} to {leg.receiver}
                      </div>
                    ))}
                  </div>
                  {myLegs.length > 0 ? (
                    <div className="leg-actions">
                      {myLegs.map(([legId, leg]) => (
                        <div key={legId} className="leg-action">
                          <div className="row-sub">
                            Your leg <Badge tone="neutral">{legId}</Badge>{' '}
                            {formatAmount(leg.amount)} {leg.instrumentId.id}
                          </div>
                          <CostPreview estimate={FEE_ESTIMATE} />
                          <div className="row-actions">
                            <button
                              className="btn btn-primary btn-small"
                              disabled={allocate.isPending}
                              onClick={() => doAllocate(trade.cid, legId)}
                            >
                              Allocate my leg
                            </button>
                            <button
                              className="btn btn-ghost btn-small"
                              disabled={reject.isPending}
                              onClick={() => reject.submitAction({ requestCid: trade.cid, action: 'reject', actor: me })}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="row-sub muted">No leg for you to allocate on this trade.</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>

      <TransactionToast
        status={toastStatus(allocate)}
        error={allocate.error}
        message={allocate.isSuccess ? 'Allocated ' + (allocating ?? '') + '.' : undefined}
      />
      <TransactionToast
        status={toastStatus(reject)}
        error={reject.error}
        message={reject.isSuccess ? 'Trade rejected.' : undefined}
      />
    </Card>
  );
}

function VenueTrades() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();

  const trades = useAllocationRequests({
    read: (signal) => backend.readTrades(signal),
    key: partyKey('trades', party),
  });
  // The venue matches allocations against trade legs from the counterparties'
  // allocation reads (party-scoped keys), then compares with the app comparator.
  const aliceAllocs = useTokenAllocations({
    read: (signal) => backend.readAllocations('alice', signal),
    key: partyKey('allocations', 'alice'),
  });
  const bobAllocs = useTokenAllocations({
    read: (signal) => backend.readAllocations('bob', signal),
    key: partyKey('allocations', 'bob'),
  });
  const combined = [...(aliceAllocs.allocations ?? []), ...(bobAllocs.allocations ?? [])];

  const createTrade = useChoice<{ ok: true }, CreateTrade>({
    exercise: (vars) => backend.submitCreateTrade(vars),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });
  const settle = useChoice<{ ok: true }, SettleTrade>({
    exercise: (vars) => backend.submitSettle(vars),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });
  const requestAction = useAllocationRequestAction<{ ok: true }>({
    submit: (request, signal) => backend.submitRequestAction(request, signal),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });
  const cancel = useAllocationAction<{ ok: true }>({
    submit: (request, signal) => backend.submitAllocationAction(request, signal),
    mutation: { onSuccess: () => invalidateAll(queryClient) },
  });

  const [usdAmount, setUsdAmount] = useState('100.00');
  const [bondAmount, setBondAmount] = useState('5.00');
  const busy = createTrade.isPending || settle.isPending || requestAction.isPending || cancel.isPending;

  return (
    <Card title="Trades" hint="useAllocationRequests + useTokenAllocations + useChoice + request/allocation actions">
      <div className="form-grid">
        <Field label="USD amount (Alice pays)">
          <input inputMode="decimal" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} />
        </Field>
        <Field label="BOND amount (Bob delivers)">
          <input inputMode="decimal" value={bondAmount} onChange={(e) => setBondAmount(e.target.value)} />
        </Field>
        <div className="field field-action">
          <button
            className="btn btn-primary"
            disabled={busy || !isPositiveAmount(usdAmount) || !isPositiveAmount(bondAmount)}
            onClick={() => createTrade.exerciseChoice({ usdAmount, bondAmount })}
          >
            New trade
          </button>
        </div>
      </div>

      <AsyncView
        isPending={trades.isPending}
        error={trades.error}
        data={trades.requests}
        isEmpty={(items) => items.length === 0}
        empty="No open trades."
      >
        {(items) => (
          <ul className="list">
            {items.map((trade) => {
              const legIds = Object.keys(trade.request.transferLegs);
              const matched = matchedLegIds(trade.request, combined);
              const allMatched = matched.length === legIds.length;
              return (
                <li key={trade.cid} className="row row-block">
                  <div className="row-main">
                    <div className="row-title">
                      Trade {trade.request.settlement.settlementRef.id}{' '}
                      <Badge tone={allMatched ? 'ok' : 'neutral'}>
                        {matched.length}/{legIds.length} allocated
                      </Badge>
                    </div>
                    {legIds.map((legId) => {
                      const leg = trade.request.transferLegs[legId];
                      const alloc = allocationForLeg(trade.request, legId, combined);
                      return (
                        <div key={legId} className="row-sub muted leg-status">
                          <span>
                            {legId}: {formatAmount(leg.amount)} {leg.instrumentId.id}{' '}
                            {alloc ? <Badge tone="ok">matched</Badge> : <Badge tone="lock">missing</Badge>}
                          </span>
                          {alloc ? (
                            <button
                              className="btn btn-ghost btn-small"
                              disabled={busy}
                              onClick={() => cancel.submitAction({ allocationCid: alloc.cid, action: 'cancel' })}
                            >
                              Cancel allocation
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="row-actions">
                    <button
                      className="btn btn-primary btn-small"
                      disabled={busy || !allMatched}
                      title={allMatched ? 'Settle atomically' : 'All legs must be allocated first'}
                      onClick={() => settle.exerciseChoice({ requestCid: trade.cid })}
                    >
                      Settle
                    </button>
                    <button
                      className="btn btn-ghost btn-small"
                      disabled={busy}
                      onClick={() => requestAction.submitAction({ requestCid: trade.cid, action: 'withdraw' })}
                    >
                      Withdraw trade
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>

      <TransactionToast status={toastStatus(createTrade)} error={createTrade.error} message={createTrade.isSuccess ? 'Trade created.' : undefined} />
      <TransactionToast status={toastStatus(settle)} error={settle.error} message={settle.isSuccess ? 'Settled atomically. Balances swapped.' : undefined} />
      <TransactionToast status={toastStatus(requestAction)} error={requestAction.error} message={requestAction.isSuccess ? 'Trade withdrawn.' : undefined} />
      <TransactionToast status={toastStatus(cancel)} error={cancel.error} message={cancel.isSuccess ? 'Allocation cancelled.' : undefined} />
    </Card>
  );
}
