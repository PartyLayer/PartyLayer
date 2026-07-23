/**
 * Live backend: the same TokenizationBackend interface, served by the DevNet gateway
 * over HTTP. Selected with VITE_BACKEND=live (demo stays the default). The browser
 * never holds a ledger credential; the gateway does all ledger and registry work.
 */
import type {
  TokenHoldingRef,
  TokenTransferInstructionRef,
  TokenAllocationRef,
  TokenTransfer,
  TransferInstructionActionRequest,
  AllocationInstructionRequest,
  AllocationActionRequest,
} from '@partylayer/react/query';
import type { TokenizationBackend, IssuerChoice } from './backend';
import type { DemoPartyKey, InstrumentConfig } from './types';

async function call<T>(base: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Gateway error ' + res.status);
  }
  return (await res.json()) as T;
}

export function createLiveBackend(gatewayUrl: string): TokenizationBackend {
  const ok = { ok: true } as const;
  return {
    readHoldings: (party, signal) => call<TokenHoldingRef[] | null>(gatewayUrl, '/tokenization/holdings', { party }, signal),
    readIncoming: (party, signal) => call<TokenTransferInstructionRef[] | null>(gatewayUrl, '/tokenization/incoming', { party }, signal),
    readHoldingRefs: (party, signal) => call<TokenHoldingRef[] | null>(gatewayUrl, '/tokenization/holdingRefs', { party }, signal),
    readInstrument: (signal) => call<InstrumentConfig | null>(gatewayUrl, '/tokenization/instrument', {}, signal),
    readSupply: (signal) => call<string | null>(gatewayUrl, '/tokenization/supply', {}, signal),
    readAllocations: (signal) => call<TokenAllocationRef[] | null>(gatewayUrl, '/tokenization/allocations', {}, signal),
    submitTransfer: (transfer: TokenTransfer, signal) => call(gatewayUrl, '/tokenization/transfer', { transfer }, signal).then(() => ok),
    submitTransferAction: (request: TransferInstructionActionRequest, signal) => call(gatewayUrl, '/tokenization/transferAction', { request }, signal).then(() => ok),
    submitIssuerChoice: (choice: IssuerChoice, signal) => call(gatewayUrl, '/tokenization/issuerChoice', { choice }, signal).then(() => ok),
    submitAllocation: (request: AllocationInstructionRequest, signal) => call(gatewayUrl, '/tokenization/allocation', { request }, signal).then(() => ok),
    submitAllocationAction: (request: AllocationActionRequest, signal) => call(gatewayUrl, '/tokenization/allocationAction', { request }, signal).then(() => ok),
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
