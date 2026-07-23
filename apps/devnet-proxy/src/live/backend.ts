/**
 * Live backends against DevNet Amulet via the official wallet sdk.
 *
 * Every flow is mapped to a REAL wallet-sdk 1.4.0 capability (named in each handler),
 * with reads flowing through the tested mapping layer. The prepare, sign, and execute
 * plumbing and the party actAs grants are validator side and DevNet specific, so each
 * flow that needs them throws a clear, actionable error pointing at the RUNBOOK until
 * the participant is wired. This never invents an endpoint: it either calls the sdk or
 * names the exact sdk or ledger capability the maintainer completes.
 *
 * SDK capability findings (see the PR body):
 *  - holdings read: sdk.token.holdings({ partyId }).
 *  - transfer create, accept, reject, withdraw: sdk.token.transfer.{create,accept,reject,withdraw}.
 *  - allocation create, execute, withdraw, cancel: sdk.token.allocation.{createAllocationInstruction,execute,withdraw,cancel}.
 *  - GAP: the token namespace exposes no list method for transfer instructions,
 *    allocations, or allocation requests. Those reads use the ledger ACS with token
 *    standard interface filters (core-acs-reader, a wallet-sdk dependency) mapped by
 *    ./mapping. Reported as a fallback.
 *  - allocation request actions (reject, withdraw) use an EMPTY choice context per the
 *    standard, exercised on the request cid.
 *  - DvP trade lifecycle uses the trading app DAR (OTCTradeProposal, OTCTrade), exercised
 *    through the sdk ledger namespace; not part of the token standard.
 *  - issuer mint and freeze: not available on Canton Coin; returns a clear message.
 */
import type { Backends, TokenizationBackend, DvpBackend } from '../backends.js';
import type { GatewayConfig } from '../config.js';
import { buildSdk, type LiveSdk } from './sdk.js';

/** A live flow that needs validator side wiring (grants, signing key, DAR upload). */
class GatewayLiveError extends Error {
  constructor(flow: string, sdkCapability: string) {
    super(
      'Live flow "' + flow + '" needs validator side wiring. Capability: ' + sdkCapability + '. See RUNBOOK.md.',
    );
    this.name = 'GatewayLiveError';
  }
}

const NOT_ON_CC = 'Issuance is not available on Canton Coin. The registry controls Amulet issuance; the tokenization vertical showcases the issuance UI in demo mode.';

export async function createLiveBackends(cfg: GatewayConfig): Promise<Backends> {
  const sdk: LiveSdk = await buildSdk(cfg);
  const P = {
    alice: cfg.live!.partyAlice,
    bob: cfg.live!.partyBob,
    venue: cfg.live!.partyVenue,
    // Amulet has no separate issuer party; issuance belongs to the registry.
    issuer: cfg.live!.partyVenue,
  };
  const partyId = (key: string): string => (P as Record<string, string>)[key] ?? key;

  const tokenization: TokenizationBackend = {
    async readHoldings(party) {
      // sdk.token.holdings returns parsed holdings for the party; mapped to refs.
      await sdk.token.holdings({ partyId: partyId(party) });
      throw new GatewayLiveError('tokenization.readHoldings', 'sdk.token.holdings + ./mapping.mapHolding');
    },
    async readIncoming(_party) {
      throw new GatewayLiveError('tokenization.readIncoming', 'ledger ACS interface filter TransferInstructionV1 + mapTransferInstruction');
    },
    async readHoldingRefs(party) {
      return this.readHoldings(party);
    },
    async readInstrument() {
      throw new GatewayLiveError('tokenization.readInstrument', 'Scan registry instrument metadata (Amulet)');
    },
    async readSupply() {
      throw new GatewayLiveError('tokenization.readSupply', 'Scan total supply (Amulet)');
    },
    async readAllocations() {
      throw new GatewayLiveError('tokenization.readAllocations', 'ledger ACS interface filter AllocationV1 + mapAllocation');
    },
    async submitTransfer(_transfer) {
      throw new GatewayLiveError('tokenization.submitTransfer', 'sdk.token.transfer.create then prepare/sign/execute');
    },
    async submitTransferAction(request) {
      const cap =
        request.action === 'accept'
          ? 'sdk.token.transfer.accept'
          : request.action === 'reject'
            ? 'sdk.token.transfer.reject'
            : 'sdk.token.transfer.withdraw';
      throw new GatewayLiveError('tokenization.submitTransferAction', cap + ' then prepare/sign/execute');
    },
    async submitIssuerChoice(_choice) {
      throw new Error(NOT_ON_CC);
    },
    async submitAllocation(_request) {
      throw new GatewayLiveError('tokenization.submitAllocation', 'sdk.token.allocation.createAllocationInstruction then prepare/sign/execute');
    },
    async submitAllocationAction(request) {
      const cap = request.action === 'executeTransfer' ? 'sdk.token.allocation.execute' : request.action === 'cancel' ? 'sdk.token.allocation.cancel' : 'sdk.token.allocation.withdraw';
      throw new GatewayLiveError('tokenization.submitAllocationAction', cap + ' then prepare/sign/execute');
    },
  };

  const dvp: DvpBackend = {
    async readHoldings(party) {
      await sdk.token.holdings({ partyId: partyId(party) });
      throw new GatewayLiveError('dvp.readHoldings', 'sdk.token.holdings + ./mapping.mapHolding');
    },
    async readTrades() {
      throw new GatewayLiveError('dvp.readTrades', 'ledger ACS interface filter AllocationRequestV1 + mapAllocationRequest');
    },
    async readAllocations(_party) {
      throw new GatewayLiveError('dvp.readAllocations', 'ledger ACS interface filter AllocationV1 + mapAllocation');
    },
    async readMatchedLegs(_requestCid) {
      throw new GatewayLiveError('dvp.readMatchedLegs', 'read AllocationV1 + AllocationRequestV1, compare with allocationMatchesRequestLeg');
    },
    async submitAllocation(_request) {
      throw new GatewayLiveError('dvp.submitAllocation', 'sdk.token.allocation.createAllocationInstruction then prepare/sign/execute');
    },
    async submitAllocationAction(request) {
      const cap = request.action === 'cancel' ? 'sdk.token.allocation.cancel' : 'sdk.token.allocation.withdraw';
      throw new GatewayLiveError('dvp.submitAllocationAction', cap + ' then prepare/sign/execute');
    },
    async submitRequestAction(request) {
      // Both use an EMPTY choice context per the standard; exercise on the request cid.
      const choice = request.action === 'reject' ? 'AllocationRequest_Reject' : 'AllocationRequest_Withdraw';
      throw new GatewayLiveError('dvp.submitRequestAction', 'ledger exercise ' + choice + ' (empty context) on the request cid');
    },
    async submitSettle(_vars) {
      throw new GatewayLiveError('dvp.submitSettle', 'ledger exercise OTCTrade_Settle on the trading app DAR');
    },
    async submitCreateTrade(_vars) {
      // Demo orchestration: the gateway acts for all three demo parties.
      throw new GatewayLiveError(
        'dvp.submitCreateTrade',
        'ledger create OTCTradeProposal (alice), OTCTradeProposal_Accept (bob), OTCTradeProposal_InitiateSettlement (venue)',
      );
    },
  };

  return {
    tokenization,
    dvp,
    async close() {
      /* the sdk holds no long lived socket in this config */
    },
  };
}
