'use client';

/**
 * CIP-0104 cost-visibility reference: a standalone, embeddable demo.
 *
 * Reads a pre-submission CostEstimation LIVE from a Canton validator (via the
 * /api/cost-estimate backend proxy) and renders it through our real hook and
 * component: useTransactionCostEstimate, then CostPreview. When no live ledger is
 * configured the proxy returns a REAL captured DevNet estimate (fixture), so the
 * page is never blank and needs no node.
 *
 * Model 2: cost is wallet-agnostic. This page uses NO PartyLayerProvider, no
 * connect, no wallet: only a QueryClientProvider (for the hook) and a
 * ThemeProvider (for CostPreview).
 */
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CostPreview, ThemeProvider } from '@partylayer/react';
import { useTransactionCostEstimate } from '@partylayer/react/query';
import { toTrafficCost } from '@partylayer/core';
import { fetchCostEstimate } from '../../lib/cost-fetcher';

/**
 * Real post-execution actual cost (`paid_traffic_cost`), captured once from a
 * controlled, successful, participant-signed execute against our DevNet
 * validator: a self-signatory ValidatorRight create (no value transfer, no CC
 * spent, only the tiny traffic cost shown here). updateId
 * 1220e61aa500a7a09f95416b188409f0ef470aa8397103b3d5ec35e07e13803d4481.
 *
 * The page shows this fixed captured snapshot rather than running an execute on
 * every visit, which would spend traffic for each visitor. In that one execute
 * the estimate was 2612 and the actual paid came in at 2577.
 */
const CAPTURED_PAID = toTrafficCost('2577');

/** Small status pill. Color plus a text label, so it never relies on color alone. */
function Badge({ label, dot, tint }: { label: string; dot: string; tint: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: '#0B0F1A',
        background: tint,
        padding: '3px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  );
}

const headingRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 6,
};
const h2Style: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: 0 };
const caption: React.CSSProperties = { color: '#475569', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 10px' };

function CostDemo() {
  const { costEstimate, isPending, error, refetch, isFetching } = useTransactionCostEstimate({
    estimate: fetchCostEstimate,
  });

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        padding: 'clamp(24px, 5vw, 40px) clamp(16px, 4vw, 24px)',
        boxSizing: 'border-box',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0B0F1A',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Transaction cost visibility</h1>
      <p style={{ color: '#475569', fontSize: 14, margin: '0 0 24px', lineHeight: 1.55 }}>
        This page reads a pre-submission traffic-cost estimate live from a Canton validator and renders
        it with PartyLayer&apos;s cost hook and <code>CostPreview</code>. The numbers are the
        validator&apos;s raw int64 traffic units.
      </p>

      <ThemeProvider theme="auto">
        {/* Live estimate: recomputed per visit, so the value moves. */}
        <section style={{ marginBottom: 28 }}>
          <div style={headingRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={h2Style}>Pre-submission estimate</h2>
              <Badge label="Live" dot="#FFCC00" tint="rgba(255,204,0,0.16)" />
            </div>
            <button
              type="button"
              className="cost-reestimate"
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                color: '#0B0F1A',
                cursor: isFetching ? 'wait' : 'pointer',
              }}
            >
              {isFetching ? 'Estimating…' : 'Re-estimate'}
            </button>
          </div>
          <p style={caption}>
            Recomputed on every visit, so this value moves. That movement is how you can tell it reads
            the validator live, not a fixed number. Press Re-estimate to read it again.
          </p>
          <CostPreview estimate={costEstimate} loading={isPending} error={error} />
        </section>

        {/* Captured paid: a fixed snapshot from one real execute, not a live value. */}
        <section style={{ marginBottom: 32 }}>
          <div style={headingRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={h2Style}>Actual paid cost</h2>
              <Badge label="Captured" dot="#10B981" tint="rgba(16,185,129,0.14)" />
            </div>
          </div>
          <p style={caption}>
            The realized cost reads <code>paid_traffic_cost</code> from a completed transaction&apos;s
            completion. This value is the real cost captured from one controlled, successful execute
            against our DevNet validator: a self-signatory ValidatorRight create with no value transfer.
            In that one execute the estimate was 2612 and the actual paid came in at 2577, a little under
            the estimate, as expected. The page shows this fixed snapshot instead of running an execute
            for every visitor.
          </p>
          <CostPreview paid={CAPTURED_PAID} />
          <p style={{ color: '#64748B', fontSize: 11.5, lineHeight: 1.4, margin: '8px 0 0' }}>
            Captured snapshot, one DevNet execute.
          </p>
        </section>
      </ThemeProvider>

      <section style={{ borderTop: '1px solid rgba(15,23,42,0.10)', paddingTop: 22 }}>
        <h2 style={{ ...h2Style, marginBottom: 8 }}>Integrating cost visibility</h2>
        <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          PartyLayer does not own ledger transport. Your dApp supplies a cost-fetcher that calls your
          validator&apos;s <code>/v2/interactive-submission/prepare</code>, typically through your own
          backend, and PartyLayer provides the types, the TanStack Query wrapper, and the UI:
        </p>
        <pre
          style={{
            background: '#0B0F1A',
            color: '#E2E8F0',
            fontSize: 12,
            lineHeight: 1.6,
            padding: '12px 14px',
            borderRadius: 10,
            margin: 0,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >{`// 1. Your fetcher returns a CostEstimation (int64 as strings)
const estimate = (signal) => fetchCostEstimate(signal);

// 2. Wrap it in the hook
const { costEstimate, isPending, error } =
  useTransactionCostEstimate({ estimate });

// 3. Render it
<CostPreview estimate={costEstimate} loading={isPending} error={error} />`}</pre>
        <p style={{ color: '#475569', fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0' }}>
          Cost values are int64 and can exceed <code>Number.MAX_SAFE_INTEGER</code>, so PartyLayer
          carries them as strings (<code>TrafficCost</code>) end to end. Use{' '}
          <code>trafficCostToBigInt</code> for arithmetic. Set <code>LEDGER_API_URL</code> (plus{' '}
          <code>LEDGER_PARTY</code>, <code>LEDGER_SYNCHRONIZER_ID</code>, <code>LEDGER_DSO_PARTY</code>)
          to read from a live validator. When unset, the proxy serves a real captured DevNet estimate.
        </p>
      </section>

      <style>{`
        .cost-reestimate { transition: background 120ms ease, border-color 120ms ease; }
        .cost-reestimate:hover:not(:disabled) { background: #f8fafc; border-color: rgba(15,23,42,0.22); }
        .cost-reestimate:focus-visible { outline: 2px solid #FFCC00; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .cost-reestimate { transition: none; } }
      `}</style>
    </main>
  );
}

export default function CostDemoPage() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <CostDemo />
    </QueryClientProvider>
  );
}
