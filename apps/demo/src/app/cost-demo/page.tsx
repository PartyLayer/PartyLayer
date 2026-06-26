'use client';

/**
 * CIP-0104 cost-visibility reference — a standalone, embeddable demo.
 *
 * Reads a pre-submission CostEstimation LIVE from a Canton validator (via the
 * /api/cost-estimate backend proxy) and renders it through our real hook +
 * component: useTransactionCostEstimate → CostPreview. When no live ledger is
 * configured the proxy returns a REAL captured DevNet estimate (fixture), so the
 * page is never blank and needs no node.
 *
 * Model 2: cost is wallet-agnostic. This page uses NO PartyLayerProvider, no
 * connect, no wallet — only a QueryClientProvider (for the hook) and a
 * ThemeProvider (for CostPreview).
 */
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CostPreview, ThemeProvider } from '@partylayer/react';
import { useTransactionCostEstimate } from '@partylayer/react/query';
import { toTrafficCost } from '@partylayer/core';
import { fetchCostEstimate } from '../../lib/cost-fetcher';

/**
 * Illustrative post-execution actual cost. We do NOT execute a transaction here
 * (no CC spent, no state change), so there is no real captured paid value yet —
 * this is a labeled sample. Wiring it live reads `paid_traffic_cost` from a
 * completed transaction's completion, which requires executing a real tx (a
 * follow-up).
 */
const SAMPLE_PAID = toTrafficCost('2610');

function CostDemo() {
  const { costEstimate, isPending, error, refetch, isFetching } = useTransactionCostEstimate({
    estimate: fetchCostEstimate,
  });

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '32px 20px',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#0B0F1A',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Transaction cost visibility</h1>
      <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
        A pre-submission traffic-cost estimate read live from a Canton validator, rendered through
        PartyLayer&apos;s cost hook and <code>CostPreview</code>. Values are the validator&apos;s raw
        int64 traffic units.
      </p>

      <ThemeProvider theme="auto">
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Pre-submission estimate</h2>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#fff',
                cursor: isFetching ? 'wait' : 'pointer',
              }}
            >
              {isFetching ? 'Estimating…' : 'Re-estimate'}
            </button>
          </div>
          <CostPreview estimate={costEstimate} loading={isPending} error={error} />
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Actual paid cost</h2>
          <p style={{ color: '#64748B', fontSize: 12.5, margin: '0 0 8px', lineHeight: 1.5 }}>
            The realized cost reads <code>paid_traffic_cost</code> from a completed transaction&apos;s
            completion. The value below is an illustrative sample — no transaction was executed here;
            wiring it live (which requires submitting a real tx) is a follow-up.
          </p>
          <CostPreview paid={SAMPLE_PAID} />
        </section>
      </ThemeProvider>

      <section style={{ borderTop: '1px solid rgba(15,23,42,0.10)', paddingTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Integrating cost visibility</h2>
        <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
          PartyLayer does not own ledger transport — your dApp supplies a cost-fetcher (calling your
          validator&apos;s <code>/v2/interactive-submission/prepare</code>, typically via your own
          backend), and PartyLayer provides the types, the TanStack Query wrapper, and the UI:
        </p>
        <pre
          style={{
            background: '#0B0F1A',
            color: '#E2E8F0',
            fontSize: 12,
            lineHeight: 1.6,
            padding: '12px 14px',
            borderRadius: 10,
            overflowX: 'auto',
            margin: 0,
          }}
        >{`// 1. Your fetcher returns a CostEstimation (int64-as-string via toTrafficCost)
const estimate = (signal) => fetchCostEstimate(signal);

// 2. Wrap it in our hook
const { costEstimate, isPending, error } =
  useTransactionCostEstimate({ estimate });

// 3. Render it
<CostPreview estimate={costEstimate} loading={isPending} error={error} />`}</pre>
        <p style={{ color: '#94A3B8', fontSize: 12, lineHeight: 1.6, margin: '10px 0 0' }}>
          Cost values are int64 and can exceed <code>Number.MAX_SAFE_INTEGER</code>, so they are
          carried as strings (<code>TrafficCost</code>) end to end; use <code>trafficCostToBigInt</code>{' '}
          for arithmetic. Set <code>LEDGER_API_URL</code> (+ <code>LEDGER_PARTY</code>,{' '}
          <code>LEDGER_SYNCHRONIZER_ID</code>, <code>LEDGER_DSO_PARTY</code>) to read from a live
          validator; unset, the proxy serves a real captured DevNet estimate.
        </p>
      </section>
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
