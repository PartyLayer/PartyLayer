/**
 * Live backends against DevNet Amulet via the official @canton-network/wallet-sdk 1.4.0,
 * a narrow typed ledger client, and the Scan registry.
 *
 * How each surface is served (stated plainly, since some reads have an sdk method and
 * some use the ledger active-contract set):
 *  - Holdings: sdk.token.utxos.list (the utxos namespace, i.e. the current holding set,
 *    not transaction history), mapped through the tested ./mapping layer.
 *  - Incoming transfer instructions, allocations, and allocation requests: the JSON
 *    Ledger API v2 active-contract set, filtered by the token-standard interface
 *    reference in ./refs. The sdk does expose allocation.pending and an allocation
 *    request fetch, but the ACS path gives one uniform read mechanism across these and
 *    reuses the tested mapping helpers, so it is used for all three for consistency.
 *  - Instrument metadata and circulating supply: the Scan registry (no sdk method).
 *  - Matched legs: read allocations and the request, compared with the published
 *    allocationMatchesRequestLeg helper (it wraps tokenDecimalEquals) from
 *    @partylayer/react, already unit tested, rather than re-deriving the rule here.
 *
 * Writes. The three demo parties live in this participant's namespace, so the
 * participant signs and a write is a direct submit-and-wait; there is no external key
 * and no prepare/execute round trip. Token-standard writes build their command through
 * the sdk (transfer.create/accept/reject/withdraw, allocation.instruction.create,
 * allocation.execute/cancel/withdraw) and submit the returned [command, disclosed] as
 * the acting local party. The DvP trade lifecycle uses the trading app DAR
 * (Splice.Testing.Apps.TradingApp: OTCTradeProposal, OTCTrade), exercised directly.
 *
 * Amulet issuance is not a Canton Coin operation; submitIssuerChoice returns a clear
 * message rather than pretending to mint.
 */
import type { Backends, TokenizationBackend, DvpBackend } from '../backends.js';
import type { GatewayConfig } from '../config.js';
import type {
  TokenHoldingRef,
  TokenTransferLeg,
  TokenSettlementInfo,
  TokenInstrumentId,
} from '../contract.js';
import {
  mapHolding,
  mapTransferInstruction,
  mapAllocation,
  mapAllocationRequest,
  type AcsEntry,
} from '../mapping.js';
import { allocationMatchesRequestLeg } from '@partylayer/react/query';
import { buildSdk, type LiveSdk } from './sdk.js';
import { LedgerClient, exerciseCommand } from './ledger.js';
import { ScanClient, type ScanInstrument } from './scan.js';
import {
  TRANSFER_INSTRUCTION_INTERFACE,
  ALLOCATION_INTERFACE,
  ALLOCATION_REQUEST_INTERFACE,
  OTC_TRADE_PROPOSAL,
  OTC_TRADE,
} from './refs.js';

const NOT_ON_CC =
  'Issuance is not available on Canton Coin. The registry controls Amulet issuance; the tokenization vertical showcases the issuance UI in demo mode.';

/** A row as sdk.token.utxos.list returns it: an id plus the token-standard interface view. */
interface UtxoRow {
  contractId: string;
  interfaceViewValue?: Record<string, unknown>;
  activeContract?: { createdEvent?: { interfaceViews?: Array<{ viewValue?: Record<string, unknown> }> } };
}

export async function createLiveBackends(cfg: GatewayConfig): Promise<Backends> {
  const live = cfg.live!;
  const sdk: LiveSdk = await buildSdk(cfg);
  const ledger = new LedgerClient(live.ledgerJsonApiUrl, live.ledgerUserId, live.ledgerAuthToken);
  const scan = new ScanClient(live.scanUrl);
  const registryUrl = scan.registryUrl();

  const P = {
    alice: live.partyAlice,
    bob: live.partyBob,
    venue: live.partyVenue,
    // Amulet has no separate issuer party; issuance belongs to the registry.
    issuer: live.partyVenue,
  };
  const partyId = (key: string): string => (P as Record<string, string>)[key] ?? key;
  const allParties = [P.alice, P.bob, P.venue];

  // The Amulet asset body and instrument id, resolved once from Scan.
  let assetCache: { asset: AssetBody; instrument: ScanInstrument; instrumentId: TokenInstrumentId } | undefined;
  async function amulet() {
    if (!assetCache) {
      const instrument = await scan.instrument('Amulet');
      assetCache = {
        instrument,
        instrumentId: { admin: instrument.admin, id: instrument.id },
        asset: {
          id: instrument.id,
          displayName: instrument.name,
          symbol: instrument.symbol,
          registryUrl,
          admin: instrument.admin,
        },
      };
    }
    return assetCache;
  }

  let seq = 0;
  const commandId = (flow: string): string => 'gw-' + flow + '-' + Date.now() + '-' + ++seq;

  // The sdk's PreparedCommand is a [command, disclosedContracts] pair. Submit it as the
  // given local party and wait. The cast localizes the sdk's loose tuple typing here.
  async function submitPrepared(prepared: unknown, actAs: string[], flow: string) {
    const [command, disclosed] = prepared as [unknown, unknown[]];
    await ledger.submitAndWait([command], disclosed ?? [], actAs, commandId(flow));
  }

  const holdingViewOf = (row: UtxoRow): Record<string, unknown> =>
    row.interfaceViewValue ??
    row.activeContract?.createdEvent?.interfaceViews?.find((iv) => iv?.viewValue)?.viewValue ??
    {};

  async function readHoldingsFor(party: string): Promise<TokenHoldingRef[]> {
    const rows = (await sdk.token.utxos.list({ partyId: partyId(party) })) as unknown as UtxoRow[];
    return rows.map((row) => mapHolding({ contractId: row.contractId, view: holdingViewOf(row) }));
  }

  /** Read one contract's interface view by cid, across the demo parties. */
  async function readOne(cid: string, interfaceRef: string): Promise<AcsEntry | undefined> {
    const entries = await ledger.activeByInterface(allParties, interfaceRef);
    return entries.find((e) => e.contractId === cid);
  }

  /** Map the party fields inside a transfer leg from demo keys to party ids. */
  const legToIds = (leg: TokenTransferLeg): TokenTransferLeg => ({
    ...leg,
    sender: partyId(leg.sender),
    receiver: partyId(leg.receiver),
    instrumentId: leg.instrumentId,
  });
  const settlementToIds = (s: TokenSettlementInfo): TokenSettlementInfo => ({
    ...s,
    executor: partyId(s.executor),
  });

  const tokenization: TokenizationBackend = {
    async readHoldings(party) {
      return readHoldingsFor(party);
    },
    async readHoldingRefs(party) {
      return readHoldingsFor(party);
    },
    async readIncoming(party) {
      const entries = await ledger.activeByInterface([partyId(party)], TRANSFER_INSTRUCTION_INTERFACE);
      return entries.map(mapTransferInstruction);
    },
    async readInstrument() {
      const i = await scan.instrument('Amulet');
      return { admin: i.admin, id: i.id, name: i.name };
    },
    async readSupply() {
      const i = await scan.instrument('Amulet');
      return i.totalSupply;
    },
    async readAllocations() {
      const entries = await ledger.activeByInterface(allParties, ALLOCATION_INTERFACE);
      return entries.map(mapAllocation);
    },
    async submitTransfer(transfer) {
      const prepared = await sdk.token.transfer.create({
        sender: partyId(transfer.sender),
        recipient: partyId(transfer.receiver),
        amount: transfer.amount,
        instrumentId: transfer.instrumentId.id,
        registryUrl,
        inputUtxos: transfer.inputHoldingCids.length ? transfer.inputHoldingCids : undefined,
      });
      await submitPrepared(prepared, [partyId(transfer.sender)], 'transfer');
      return { ok: true };
    },
    async submitTransferAction(request) {
      const params = { transferInstructionCid: request.instructionCid, registryUrl };
      const prepared =
        request.action === 'accept'
          ? await sdk.token.transfer.accept(params)
          : request.action === 'reject'
            ? await sdk.token.transfer.reject(params)
            : await sdk.token.transfer.withdraw(params);
      // Accept and reject are the receiver's choices; withdraw is the sender's. Read the
      // instruction to act as the correct controller.
      const entry = await readOne(request.instructionCid, TRANSFER_INSTRUCTION_INTERFACE);
      const t = entry ? mapTransferInstruction(entry).instruction.transfer : undefined;
      const actor = request.action === 'withdraw' ? t?.sender : t?.receiver;
      await submitPrepared(prepared, actor ? [actor] : allParties, 'transfer-action');
      return { ok: true };
    },
    async submitIssuerChoice(_choice) {
      throw new Error(NOT_ON_CC);
    },
    async submitAllocation(request) {
      const { asset } = await amulet();
      // The sdk types the specification with branded Daml types; the gateway's structurally
      // identical CIP-0056 shapes are adapted through the param type here.
      const params = {
        allocationSpecification: {
          settlement: settlementToIds(request.allocation.settlement),
          transferLegId: request.allocation.transferLegId,
          transferLeg: legToIds(request.allocation.transferLeg),
        },
        asset,
        inputUtxos: request.inputHoldingCids.length ? request.inputHoldingCids : undefined,
        requestedAt: request.requestedAt,
      } as unknown as Parameters<typeof sdk.token.allocation.instruction.create>[0];
      const prepared = await sdk.token.allocation.instruction.create(params);
      const owner = partyId(request.allocation.transferLeg.sender);
      await submitPrepared(prepared, [owner], 'allocation-create');
      return { ok: true };
    },
    async submitAllocationAction(request) {
      const { asset } = await amulet();
      const params = { allocationCid: request.allocationCid, asset };
      const prepared =
        request.action === 'executeTransfer'
          ? await sdk.token.allocation.execute(params)
          : request.action === 'cancel'
            ? await sdk.token.allocation.cancel(params)
            : await sdk.token.allocation.withdraw(params);
      const actor = await allocationActor(request.allocationCid, request.action);
      await submitPrepared(prepared, actor, 'allocation-action');
      return { ok: true };
    },
  };

  /** The controller for an allocation choice: the executor settles, the owner cancels/withdraws. */
  async function allocationActor(cid: string, action: 'executeTransfer' | 'cancel' | 'withdraw'): Promise<string[]> {
    const entry = await readOne(cid, ALLOCATION_INTERFACE);
    if (!entry) return allParties;
    const a = mapAllocation(entry).allocation.allocation;
    return action === 'executeTransfer' ? [a.settlement.executor] : [a.transferLeg.sender];
  }

  const dvp: DvpBackend = {
    async readHoldings(party) {
      return readHoldingsFor(party);
    },
    async readTrades() {
      const entries = await ledger.activeByInterface(allParties, ALLOCATION_REQUEST_INTERFACE);
      return entries.map(mapAllocationRequest);
    },
    async readAllocations(party) {
      const entries = await ledger.activeByInterface([partyId(party)], ALLOCATION_INTERFACE);
      return entries.map(mapAllocation);
    },
    async readMatchedLegs(requestCid) {
      const [allocEntries, requestEntries] = await Promise.all([
        ledger.activeByInterface(allParties, ALLOCATION_INTERFACE),
        ledger.activeByInterface(allParties, ALLOCATION_REQUEST_INTERFACE),
      ]);
      const request = requestEntries.map(mapAllocationRequest).find((r) => r.cid === requestCid);
      if (!request) return [];
      const allocations = allocEntries.map(mapAllocation);
      const matched: string[] = [];
      for (const legId of Object.keys(request.request.transferLegs)) {
        if (allocations.some((a) => allocationMatchesRequestLeg(a.allocation, request.request, legId))) {
          matched.push(legId);
        }
      }
      return matched;
    },
    submitAllocation: tokenization.submitAllocation,
    async submitAllocationAction(request) {
      // The DvP vertical only cancels or withdraws; both are the allocation owner's choice.
      return tokenization.submitAllocationAction(request);
    },
    async submitRequestAction(request) {
      // AllocationRequest_Reject and _Withdraw are exercised on the request contract by
      // interface, with an empty choice context per the standard. Reject is the trader's
      // choice; withdraw is the venue's.
      if (request.action === 'reject') {
        const command = exerciseCommand(ALLOCATION_REQUEST_INTERFACE, request.requestCid, 'AllocationRequest_Reject', {
          actor: partyId(request.actor),
          extraArgs: { context: { values: {} }, meta: { values: {} } },
        });
        await ledger.submitAndWait([command], [], [partyId(request.actor)], commandId('request-reject'));
        return { ok: true };
      }
      const command = exerciseCommand(ALLOCATION_REQUEST_INTERFACE, request.requestCid, 'AllocationRequest_Withdraw', {
        extraArgs: { context: { values: {} }, meta: { values: {} } },
      });
      await ledger.submitAndWait([command], [], [P.venue], commandId('request-withdraw'));
      return { ok: true };
    },
    async submitSettle(vars) {
      // OTCTrade_Settle is the venue's choice on the trade contract. Its argument is the
      // allocations keyed by leg, each paired with its execute context. A Daml TextMap
      // encodes as a plain object and a (ContractId, ExtraArgs) tuple as { _1, _2 }.
      const allocEntries = await ledger.activeByInterface(allParties, ALLOCATION_INTERFACE);
      const allocationsWithContext: Record<string, unknown> = {};
      for (const e of allocEntries) {
        const alloc = mapAllocation(e);
        allocationsWithContext[alloc.allocation.allocation.transferLegId] = {
          _1: e.contractId,
          _2: { context: { values: {} }, meta: { values: {} } },
        };
      }
      const command = exerciseCommand(OTC_TRADE, vars.requestCid, 'OTCTrade_Settle', { allocationsWithContext });
      await ledger.submitAndWait([command], [], [P.venue], commandId('settle'));
      return { ok: true };
    },
    async submitCreateTrade(vars) {
      // Demo orchestration across the three demo parties: alice proposes an OTC trade with
      // two symmetric legs, bob approves, the venue initiates settlement. Alice, the first
      // approver, creates and signs. transferLegs is a bare Daml TextMap (a plain object).
      const { instrumentId } = await amulet();
      const leg = (sender: string, receiver: string, amount: string): TokenTransferLeg => ({
        sender,
        receiver,
        amount,
        instrumentId,
      });
      const createArguments = {
        venue: P.venue,
        tradeCid: null,
        transferLegs: { leg0: leg(P.alice, P.bob, vars.usdAmount), leg1: leg(P.bob, P.alice, vars.bondAmount) },
        approvers: [P.alice],
      };
      const command = { CreateCommand: { templateId: OTC_TRADE_PROPOSAL, createArguments } };
      await ledger.submitAndWait([command], [], [P.alice], commandId('trade-create'));
      return { ok: true };
    },
  };

  return {
    tokenization,
    dvp,
    async close() {
      /* the sdk and clients hold no long lived socket in this config */
    },
  };
}

/** The wallet-sdk asset body for the Amulet instrument. Mirrors the sdk's AssetBody. */
interface AssetBody {
  id: string;
  displayName: string;
  symbol: string;
  registryUrl: URL;
  admin: string;
}
