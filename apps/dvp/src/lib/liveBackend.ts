/**
 * Live backend: the same DvpBackend interface, served by the DevNet gateway over
 * HTTP. Selected with VITE_BACKEND=live (demo stays the default). The browser never
 * holds a ledger credential; the gateway does all ledger and registry work.
 */
import type {
  TokenHoldingRef,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  AllocationInstructionRequest,
  AllocationActionRequest,
  AllocationRequestActionRequest,
} from '@partylayer/react/query';
import type { DvpBackend } from './backend';
import type { DemoPartyKey, SettleTrade, CreateTrade } from './types';
import { mapGatewayError } from './gateway-errors';
import { withRetry } from './retry';

async function call<T>(base: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    throw mapGatewayError(res.status, raw);
  }
  return (await res.json()) as T;
}

export function createLiveBackend(gatewayUrl: string): DvpBackend {
  const ok = { ok: true } as const;
  return {
    readHoldings: (party, signal) => call<TokenHoldingRef[] | null>(gatewayUrl, '/dvp/holdings', { party }, signal),
    readTrades: (signal) => call<TokenAllocationRequestRef[] | null>(gatewayUrl, '/dvp/trades', {}, signal),
    readAllocations: (party, signal) => call<TokenAllocationRef[] | null>(gatewayUrl, '/dvp/allocations', { party }, signal),
    readMatchedLegs: (requestCid, signal) => call<string[]>(gatewayUrl, '/dvp/matchedLegs', { requestCid }, signal),
    submitAllocation: (request: AllocationInstructionRequest, signal) => withRetry((s) => call(gatewayUrl, '/dvp/allocation', { request }, s), signal).then(() => ok),
    submitAllocationAction: (request: AllocationActionRequest, signal) => withRetry((s) => call(gatewayUrl, '/dvp/allocationAction', { request }, s), signal).then(() => ok),
    submitRequestAction: (request: AllocationRequestActionRequest, signal) => withRetry((s) => call(gatewayUrl, '/dvp/requestAction', { request }, s), signal).then(() => ok),
    submitSettle: (vars: SettleTrade, signal) => withRetry((s) => call(gatewayUrl, '/dvp/settle', { vars }, s), signal).then(() => ok),
    submitCreateTrade: (vars: CreateTrade, signal) => withRetry((s) => call(gatewayUrl, '/dvp/createTrade', { vars }, s), signal).then(() => ok),
  };
}

/** Party display labels from the gateway /config (GET; used in live mode). */
export async function fetchGatewayParties(gatewayUrl: string): Promise<Partial<Record<DemoPartyKey, string>>> {
  try {
    const res = await fetch(gatewayUrl.replace(/\/$/, '') + '/config');
    if (!res.ok) return {};
    const cfg = (await res.json()) as { parties?: Record<string, string> };
    return (cfg.parties ?? {}) as Partial<Record<DemoPartyKey, string>>;
  } catch {
    return {};
  }
}
