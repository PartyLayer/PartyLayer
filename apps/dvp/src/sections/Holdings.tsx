/**
 * Holdings section. Exercises useTokenHoldings (CIP-0056 typed read). Renders each
 * holding with the owner avatar, the amount (string precision preserved), the
 * instrument, and a lock badge when the holding carries a TokenLock.
 */
import { useTokenHoldings } from '@partylayer/react/query';
import { PartyAvatar } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView, Badge } from '../ui/primitives';
import { formatAmount } from '../lib/format';

export function Holdings() {
  const { party, backend } = useDemo();
  const q = useTokenHoldings({
    read: (signal) => backend.readHoldings(party, signal),
    key: partyKey('holdings', party),
  });

  return (
    <Card title="Holdings" hint="useTokenHoldings">
      <AsyncView
        isPending={q.isPending}
        error={q.error}
        data={q.holdings}
        isEmpty={(refs) => refs.length === 0}
        empty="No holdings for this party."
      >
        {(refs) => (
          <ul className="list">
            {refs.map(({ cid, holding: h }) => (
              <li key={cid} className="row">
                <PartyAvatar id={h.owner} size={28} />
                <div className="row-main">
                  <div className="row-title">
                    {formatAmount(h.amount)} <span className="muted">{h.instrumentId.id}</span>
                  </div>
                  <div className="row-sub muted">admin {h.instrumentId.admin}</div>
                </div>
                {h.lock ? (
                  <Badge tone="lock" title={'expires ' + (h.lock.expiresAt ?? 'never')}>
                    Locked: {h.lock.context ?? 'held'}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </Card>
  );
}
