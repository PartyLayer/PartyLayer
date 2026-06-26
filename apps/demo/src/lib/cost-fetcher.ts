/**
 * The dApp's cost-fetcher for the CIP-0104 demo.
 *
 * Model 2: PartyLayer does not own ledger transport — the dApp supplies this
 * fetcher. It POSTs to the backend proxy (/api/cost-estimate), then maps the
 * proxy's int64-as-string cost values through core's `toTrafficCost` into a
 * `CostEstimation`. Pass it to `useTransactionCostEstimate({ estimate })`.
 */
import { toTrafficCost, type CostEstimation } from '@partylayer/core';

interface ProxyEstimation {
  estimationTimestamp: string;
  confirmationRequestTrafficCostEstimation: string;
  confirmationResponseTrafficCostEstimation: string;
  totalTrafficCostEstimation: string;
}

/**
 * Fetch a pre-submission cost estimate from the backend proxy.
 * Returns `null` when the ledger reports no estimate (a successful result).
 * Throws on transport/validator errors (surfaced by the hook as `error`).
 */
export async function fetchCostEstimate(signal?: AbortSignal): Promise<CostEstimation | null> {
  const res = await fetch('/api/cost-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal,
  });

  if (!res.ok) {
    let message = `Cost estimate failed (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the status-based message
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { costEstimation: ProxyEstimation | null };
  if (!data.costEstimation) return null;

  const c = data.costEstimation;
  return {
    estimationTimestamp: c.estimationTimestamp,
    // int64-as-string → validated, branded TrafficCost (precision preserved).
    confirmationRequestTrafficCostEstimation: toTrafficCost(c.confirmationRequestTrafficCostEstimation),
    confirmationResponseTrafficCostEstimation: toTrafficCost(c.confirmationResponseTrafficCostEstimation),
    totalTrafficCostEstimation: toTrafficCost(c.totalTrafficCostEstimation),
  };
}
