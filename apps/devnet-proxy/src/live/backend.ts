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
  TokenTransfer,
  TokenTransferLeg,
  TokenSettlementInfo,
  TokenInstrumentId,
  AllocationInstructionRequest,
} from '../contract.js';
import {
  mapHolding,
  mapTransferInstruction,
  mapAllocation,
  mapAllocationRequest,
  type AcsEntry,
} from '../mapping.js';
import { makeToKey, makeToLedgerId, reverseLeg } from '../party-map.js';
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
  const ledger = new LedgerClient(live.ledgerJsonApiUrl, live.ledgerUserId, live.ledgerAuthToken, live.synchronizerId);
  const scan = new ScanClient(live.scanUrl);
  const registryUrl = scan.registryUrl();

  const P = {
    alice: live.partyAlice,
    bob: live.partyBob,
    venue: live.partyVenue,
    // Amulet has no separate issuer party; issuance belongs to the registry.
    issuer: live.partyVenue,
  };
  // Symmetric party map: keys go to ledger ids inbound (every submitted party
  // field), ledger ids go back to keys outbound (the fields the apps compare), so
  // the app compares keys in demo and live alike. Raw ledger ids are kept on the
  // read payload under senderLedgerId/receiverLedgerId (see reverseLeg).
  const partyId = makeToLedgerId(P);
  const toKey = makeToKey(P);
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

  // The estimate twin of submitPrepared: interpret the SAME prepared command to read its
  // cost, rather than submitting it. prepare does not commit, so no traffic is spent. The
  // cost degrades to null (missing synchronizer, non-OK response, parse failure).
  async function estimatePrepared(prepared: unknown, actAs: string[], flow: string) {
    const [command, disclosed] = prepared as [unknown, unknown[]];
    const costEstimation = await ledger.prepareForCost([command], disclosed ?? [], actAs, commandId(flow));
    return { costEstimation };
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

  // A Daml Metadata value is `{ values: <TextMap> }`; the gateway holds the flat map.
  const damlMeta = (m?: Record<string, string>) => ({ values: m ?? {} });
  // Build the Daml-shaped transfer leg and settlement for a command, mapping demo keys to
  // party ids and wrapping meta. Used only for the standalone (non-DvP) fallback; the DvP
  // path takes the raw on-ledger values so they match the trade exactly.
  const damlLeg = (leg: TokenTransferLeg) => ({
    sender: partyId(leg.sender),
    receiver: partyId(leg.receiver),
    amount: leg.amount,
    instrumentId: leg.instrumentId,
    meta: damlMeta(leg.meta),
  });
  const damlSettlement = (s: TokenSettlementInfo) => ({
    executor: partyId(s.executor),
    settlementRef: s.settlementRef,
    requestedAt: s.requestedAt,
    allocateBefore: s.allocateBefore,
    settleBefore: s.settleBefore,
    meta: damlMeta(s.meta),
  });

  // Build the SAME prepared transfer command for both submit and estimate, so the cost
  // shown before confirm is for the exact transaction submit sends.
  async function buildTransferCommand(transfer: TokenTransfer): Promise<{ prepared: unknown; actAs: string[] }> {
    const prepared = await sdk.token.transfer.create({
      sender: partyId(transfer.sender),
      recipient: partyId(transfer.receiver),
      amount: transfer.amount,
      instrumentId: transfer.instrumentId.id,
      registryUrl,
      inputUtxos: transfer.inputHoldingCids.length ? transfer.inputHoldingCids : undefined,
    });
    return { prepared, actAs: [partyId(transfer.sender)] };
  }

  // Build the SAME prepared allocation command for both submit and estimate.
  async function buildAllocationCommand(request: AllocationInstructionRequest): Promise<{ prepared: unknown; actAs: string[] }> {
    const { asset } = await amulet();
    const legId = request.allocation.transferLegId;
    // The settle choice checks each allocation for structural equality with the trade's
    // expected spec, so the allocation must be built from the trade's own settlement and
    // leg. Read the on-ledger allocation request this is for (matched by settlement ref)
    // and take its raw view, which is already the exact Daml shape. Fall back to the
    // request payload for a standalone allocation with no on-ledger request.
    // The settlement ref's `id` is a shared constant across trades; only its `cid` is
    // unique, so match on the cid when present and fall back to the id only without one.
    const ref = request.allocation.settlement.settlementRef ?? { id: '', cid: undefined };
    const rawReq = (await ledger.activeByInterface(allParties, ALLOCATION_REQUEST_INTERFACE))
      .map((e) => e.view as { settlement?: { settlementRef?: { id?: string; cid?: string } }; transferLegs?: Record<string, unknown> })
      .find((v) => {
        const r = v.settlement?.settlementRef ?? {};
        return ref.cid ? r.cid === ref.cid : !!ref.id && r.id === ref.id;
      });
    const rawLeg = rawReq?.transferLegs?.[legId];
    const allocationSpecification = rawLeg
      ? { settlement: rawReq!.settlement, transferLegId: legId, transferLeg: rawLeg }
      : {
          settlement: damlSettlement(request.allocation.settlement),
          transferLegId: legId,
          transferLeg: damlLeg(request.allocation.transferLeg),
        };
    // The sdk types the spec with branded Daml types; the gateway's structurally identical
    // shapes are adapted through the param type here.
    const params = {
      allocationSpecification,
      asset,
      inputUtxos: request.inputHoldingCids.length ? request.inputHoldingCids : undefined,
      requestedAt: request.requestedAt,
    } as unknown as Parameters<typeof sdk.token.allocation.instruction.create>[0];
    const prepared = await sdk.token.allocation.instruction.create(params);
    const owner = partyId((allocationSpecification.transferLeg as { sender: string }).sender);
    return { prepared, actAs: [owner] };
  }

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
      const { prepared, actAs } = await buildTransferCommand(transfer);
      await submitPrepared(prepared, actAs, 'transfer');
      return { ok: true };
    },
    async estimateTransfer(transfer) {
      // Graceful: any failure to obtain a live estimate returns null, so the UI shows an
      // illustrative caption rather than an error and submit is never blocked.
      try {
        const { prepared, actAs } = await buildTransferCommand(transfer);
        return await estimatePrepared(prepared, actAs, 'transfer-estimate');
      } catch {
        return { costEstimation: null };
      }
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
      const { prepared, actAs } = await buildAllocationCommand(request);
      await submitPrepared(prepared, actAs, 'allocation-create');
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
      // Reverse-map each leg's sender/receiver to keys so the app's "my legs" test
      // (leg.sender === party key) works; raw ledger ids stay under senderLedgerId.
      return entries.map(mapAllocationRequest).map((ref) => ({
        ...ref,
        request: {
          ...ref.request,
          transferLegs: Object.fromEntries(
            Object.entries(ref.request.transferLegs).map(([legId, leg]) => [legId, reverseLeg(leg, toKey)]),
          ),
        },
      }));
    },
    async readAllocations(party) {
      const entries = await ledger.activeByInterface([partyId(party)], ALLOCATION_INTERFACE);
      // Reverse-map the allocation owner (its leg sender/receiver) to keys.
      return entries.map(mapAllocation).map((ref) => ({
        ...ref,
        allocation: {
          ...ref.allocation,
          allocation: {
            ...ref.allocation.allocation,
            transferLeg: reverseLeg(ref.allocation.allocation.transferLeg, toKey),
          },
        },
      }));
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
    async estimateAllocation(request) {
      // Graceful: any failure to obtain a live estimate returns null, so the UI shows an
      // illustrative caption rather than an error and allocation is never blocked.
      try {
        const { prepared, actAs } = await buildAllocationCommand(request);
        return await estimatePrepared(prepared, actAs, 'allocation-estimate');
      } catch {
        return { costEstimation: null };
      }
    },
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
      // OTCTrade_Settle is the venue's choice on the trade. Its argument maps each leg to
      // its allocation and that allocation's execute context. `vars.requestCid` is the
      // OTCTrade, which is the AllocationRequest. Read it, and for each leg find the
      // allocation that matches it (matched on settlement + leg by the published helper, so
      // a stale allocation from another trade is not picked). Fetch the registry execute
      // context per allocation, thread the disclosed contracts, then settle. A Daml TextMap
      // encodes as a plain object and a (ContractId, ExtraArgs) tuple as { _1, _2 }.
      const reqEntry = (await ledger.activeByInterface(allParties, ALLOCATION_REQUEST_INTERFACE)).find(
        (e) => e.contractId === vars.requestCid,
      );
      if (!reqEntry) throw new Error('settle: trade ' + vars.requestCid + ' is not an active allocation request');
      const request = mapAllocationRequest(reqEntry);
      const allocEntries = await ledger.activeByInterface(allParties, ALLOCATION_INTERFACE);
      const allocationsWithContext: Record<string, unknown> = {};
      const disclosed: unknown[] = [];
      for (const legId of Object.keys(request.request.transferLegs)) {
        const match = allocEntries.find((e) =>
          allocationMatchesRequestLeg(mapAllocation(e).allocation, request.request, legId),
        );
        if (!match) throw new Error('settle: no allocation matches leg ' + legId + ' of trade ' + vars.requestCid);
        const ctx = (await sdk.token.allocation.context.execute({
          allocationCid: match.contractId,
          registryUrl,
        })) as { choiceContextData?: unknown; disclosedContracts?: unknown[] };
        allocationsWithContext[legId] = {
          _1: match.contractId,
          _2: { context: ctx.choiceContextData, meta: { values: {} } },
        };
        for (const d of ctx.disclosedContracts ?? []) disclosed.push(d);
      }
      const command = exerciseCommand(OTC_TRADE, vars.requestCid, 'OTCTrade_Settle', { allocationsWithContext });
      await ledger.submitAndWait([command], disclosed, [P.venue], commandId('settle'));
      return { ok: true };
    },
    async submitCreateTrade(vars) {
      // Demo orchestration across the three demo parties: alice proposes an OTC trade with
      // two symmetric legs, bob approves, the venue initiates settlement. Each step consumes
      // the previous contract and creates the next, so the created id is threaded forward.
      // transferLegs is a bare Daml TextMap (a plain object) and each leg carries a meta.
      const { instrumentId } = await amulet();
      const leg = (sender: string, receiver: string, amount: string) => ({
        sender,
        receiver,
        amount,
        instrumentId,
        meta: { values: {} },
      });
      const createdId = (created: { templateId: string; contractId: string }[], entity: string): string => {
        const hit = created.find((c) => c.templateId.endsWith(':' + entity));
        if (!hit) throw new Error('createTrade: expected a created ' + entity + ' but none was in the transaction');
        return hit.contractId;
      };
      // 1. alice proposes and signs as the first approver.
      const r1 = await ledger.submitAndWaitForTransactionTree(
        [
          {
            CreateCommand: {
              templateId: OTC_TRADE_PROPOSAL,
              createArguments: {
                venue: P.venue,
                tradeCid: null,
                transferLegs: { leg0: leg(P.alice, P.bob, vars.usdAmount), leg1: leg(P.bob, P.alice, vars.bondAmount) },
                approvers: [P.alice],
              },
            },
          },
        ],
        [],
        [P.alice],
        commandId('trade-create'),
      );
      // 2. bob approves; the choice recreates the proposal with both approvers.
      const r2 = await ledger.submitAndWaitForTransactionTree(
        [exerciseCommand(OTC_TRADE_PROPOSAL, createdId(r1.created, 'OTCTradeProposal'), 'OTCTradeProposal_Accept', { approver: P.bob })],
        [],
        [P.bob],
        commandId('trade-accept'),
      );
      // 3. venue initiates settlement, which creates the OTCTrade (the AllocationRequest).
      const nowMs = Date.now();
      await ledger.submitAndWaitForTransactionTree(
        [
          exerciseCommand(OTC_TRADE_PROPOSAL, createdId(r2.created, 'OTCTradeProposal'), 'OTCTradeProposal_InitiateSettlement', {
            prepareUntil: new Date(nowMs + 3600_000).toISOString(),
            settleBefore: new Date(nowMs + 7200_000).toISOString(),
          }),
        ],
        [],
        [P.venue],
        commandId('trade-initiate'),
      );
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
