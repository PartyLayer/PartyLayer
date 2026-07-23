/**
 * Mock backends: serve the endpoint contract from the in-memory fixture store, with
 * small artificial latency so loading states are visible. Proves the full stack today
 * without DevNet.
 */
import type { Backends, TokenizationBackend, DvpBackend } from '../backends.js';
import { mockStore } from './store.js';

const latency = () => new Promise<void>((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));
const ok = { ok: true } as const;

export function createMockBackends(): Backends {
  const tokenization: TokenizationBackend = {
    async readHoldings(party) {
      await latency();
      return mockStore.tokHoldings(party);
    },
    async readIncoming(party) {
      await latency();
      return mockStore.tokIncoming(party);
    },
    async readHoldingRefs(party) {
      await latency();
      return mockStore.tokHoldings(party);
    },
    async readInstrument() {
      await latency();
      return mockStore.tokInstrument();
    },
    async readSupply() {
      await latency();
      return mockStore.tokSupply();
    },
    async readAllocations() {
      await latency();
      return mockStore.tokAllocations();
    },
    async submitTransfer(transfer) {
      await latency();
      mockStore.tokTransfer(transfer);
      return ok;
    },
    async submitTransferAction(request) {
      await latency();
      mockStore.tokTransferAction(request);
      return ok;
    },
    async submitIssuerChoice(choice) {
      await latency();
      mockStore.tokIssuerChoice(choice);
      return ok;
    },
    async submitAllocation(request) {
      await latency();
      mockStore.tokAllocation(request);
      return ok;
    },
    async submitAllocationAction(request) {
      await latency();
      mockStore.tokAllocationAction(request);
      return ok;
    },
  };

  const dvp: DvpBackend = {
    async readHoldings(party) {
      await latency();
      return mockStore.dvpHoldings(party);
    },
    async readTrades() {
      await latency();
      return mockStore.dvpTrades();
    },
    async readAllocations(party) {
      await latency();
      return mockStore.dvpAllocations(party);
    },
    async readMatchedLegs(requestCid) {
      await latency();
      return mockStore.dvpMatchedLegs(requestCid);
    },
    async submitAllocation(request) {
      await latency();
      mockStore.dvpAllocation(request);
      return ok;
    },
    async submitAllocationAction(request) {
      await latency();
      mockStore.dvpAllocationAction(request);
      return ok;
    },
    async submitRequestAction(request) {
      await latency();
      mockStore.dvpRequestAction(request);
      return ok;
    },
    async submitSettle(vars) {
      await latency();
      mockStore.dvpSettle(vars);
      return ok;
    },
    async submitCreateTrade(vars) {
      await latency();
      mockStore.dvpCreateTrade(vars);
      return ok;
    },
  };

  return {
    tokenization,
    dvp,
    async close() {
      /* nothing to close in mock mode */
    },
  };
}
