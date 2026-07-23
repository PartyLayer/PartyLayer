/**
 * Issuer section. Visible for every party; actionable only as the issuer (a hint
 * shows otherwise). Reads the instrument config and total supply through the
 * generic useDamlContract, and performs registry-specific admin writes (mint,
 * freeze/unfreeze) through the generic useChoice: the escape hatch for writes the
 * typed CIP-0056 hooks do not cover.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDamlContract, useChoice, type TokenHoldingRef } from '@partylayer/react/query';
import { TransactionToast } from '@partylayer/react';
import { useDemo, partyKey } from '../context/DemoContext';
import { Card, AsyncView, Badge, Field } from '../ui/primitives';
import { toastStatus } from '../lib/mutation';
import { invalidateHoldingsAndReads } from '../lib/invalidate';
import { formatAmount, isPositiveAmount } from '../lib/format';
import { PARTIES, PARTY_ORDER } from '../lib/fixtures';
import type { IssuerChoice } from '../lib/backend';
import type { DemoPartyKey, InstrumentConfig } from '../lib/types';

export function Issuer() {
  const { party, backend } = useDemo();
  const queryClient = useQueryClient();
  // In live mode issuance is disabled: on Canton Coin the registry controls Amulet
  // issuance, so mint and freeze are demo-only. The panel stays visible to showcase
  // the issuance UI, with actions disabled and a short explanation.
  const isLive = import.meta.env.VITE_BACKEND === 'live';
  const isIssuer = party === 'issuer' && !isLive;

  const instrument = useDamlContract<InstrumentConfig>({
    read: (signal) => backend.readInstrument(signal),
    key: ['tokenization', 'instrument'],
  });
  const supply = useDamlContract<string>({
    read: (signal) => backend.readSupply(signal),
    key: ['tokenization', 'supply'],
  });

  const [mintTarget, setMintTarget] = useState<DemoPartyKey>('alice');
  const [mintAmount, setMintAmount] = useState('');
  const [freezeTarget, setFreezeTarget] = useState<DemoPartyKey>('alice');

  const refreshAll = () => invalidateHoldingsAndReads(queryClient);

  const issuerChoice = useChoice<{ ok: true }, IssuerChoice>({
    exercise: (choice) => backend.submitIssuerChoice(choice),
    mutation: { onSuccess: refreshAll },
  });

  const freezeRefs = useDamlContract<TokenHoldingRef[]>({
    read: (signal) => backend.readHoldingRefs(freezeTarget, signal),
    key: partyKey('holdingRefs', freezeTarget),
  });

  const doMint = () => {
    if (!isPositiveAmount(mintAmount)) return;
    issuerChoice.exerciseChoice({ kind: 'mint', toParty: mintTarget, amount: mintAmount });
    setMintAmount('');
  };

  const toggleFreeze = (ref: TokenHoldingRef) => {
    issuerChoice.exerciseChoice({
      kind: 'setFrozen',
      party: freezeTarget,
      cid: ref.cid,
      frozen: !ref.holding.lock,
    });
  };

  return (
    <Card title="Issuer" hint="useDamlContract + useChoice">
      <div className="issuer-summary">
        <AsyncView
          isPending={instrument.isPending}
          error={instrument.error}
          data={instrument.contract}
          isEmpty={() => false}
          empty=""
          rows={2}
        >
          {(cfg) => (
            <div>
              <div className="row-title">
                {cfg.name} <span className="muted">{cfg.id}</span>
              </div>
              <div className="row-sub muted">{cfg.description}</div>
              <div className="row-sub muted">admin {cfg.admin}</div>
            </div>
          )}
        </AsyncView>
        <div className="supply">
          <span className="muted">Total supply</span>
          <strong>{supply.isPending ? '...' : formatAmount(supply.contract ?? '0.00')}</strong>
        </div>
      </div>

      {!isIssuer ? (
        <div className="state state-empty">
          {isLive ? (
            <>
              Issuance is not available on Canton Coin: the registry controls Amulet issuance. Mint and
              freeze are shown here in demo mode to showcase the issuance UI.
            </>
          ) : (
            <>
              Switch the demo party to <strong>Issuer</strong> to mint and freeze.
            </>
          )}
        </div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Mint to">
              <select value={mintTarget} onChange={(e) => setMintTarget(e.target.value as DemoPartyKey)}>
                {PARTY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PARTIES[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
              />
            </Field>
            <div className="field field-action">
              <button className="btn btn-primary" onClick={doMint} disabled={issuerChoice.isPending}>
                Mint
              </button>
            </div>
          </div>

          <div className="freeze">
            <Field label="Freeze holdings of">
              <select value={freezeTarget} onChange={(e) => setFreezeTarget(e.target.value as DemoPartyKey)}>
                {PARTY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PARTIES[p].label}
                  </option>
                ))}
              </select>
            </Field>
            <AsyncView
              isPending={freezeRefs.isPending}
              error={freezeRefs.error}
              data={freezeRefs.contract}
              isEmpty={(refs) => refs.length === 0}
              empty="No holdings to freeze."
              rows={2}
            >
              {(refs) => (
                <ul className="list">
                  {refs.map((ref) => (
                    <li key={ref.cid} className="row">
                      <div className="row-main">
                        <div className="row-title">
                          {formatAmount(ref.holding.amount)}{' '}
                          <span className="muted">{ref.holding.instrumentId.id}</span>
                        </div>
                        <div className="row-sub muted">{ref.cid}</div>
                      </div>
                      {ref.holding.lock ? <Badge tone="lock">Frozen</Badge> : null}
                      <button
                        className="btn btn-ghost"
                        disabled={issuerChoice.isPending}
                        onClick={() => toggleFreeze(ref)}
                      >
                        {ref.holding.lock ? 'Unfreeze' : 'Freeze'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </div>

          <TransactionToast
            status={toastStatus(issuerChoice)}
            error={issuerChoice.error}
            message={issuerChoice.isSuccess ? 'Issuer action applied.' : undefined}
          />
        </>
      )}
    </Card>
  );
}
