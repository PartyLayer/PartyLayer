/**
 * Token-standard interface references, in package-name (`#`) form.
 *
 * Phase 3 against the real DevNet participant proved that a pinned package id matches
 * nothing, while the package-name form resolves to the version the participant vets. So
 * every interface read uses these, and nothing else, from one place: no call site can
 * pin an id and silently drift.
 *
 * Verified to resolve (HTTP 200) on the DevNet participant: Holding returned live data,
 * the other three returned an empty set until a trade exists, both of which prove the
 * reference resolved rather than silently failing.
 */
export const HOLDING_INTERFACE =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding';
export const TRANSFER_INSTRUCTION_INTERFACE =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction';
export const ALLOCATION_INTERFACE =
  '#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation';
export const ALLOCATION_REQUEST_INTERFACE =
  '#splice-api-token-allocation-request-v1:Splice.Api.Token.AllocationRequestV1:AllocationRequest';

/**
 * The trading app DAR templates, in the same package-name form. This is the DAR built
 * and uploaded in Phase 1 (splice-token-test-trading-app, module
 * Splice.Testing.Apps.TradingApp). The DvP trade lifecycle is exercised on these
 * directly; they are not part of the token standard.
 */
export const OTC_TRADE_PROPOSAL =
  '#splice-token-test-trading-app:Splice.Testing.Apps.TradingApp:OTCTradeProposal';
export const OTC_TRADE = '#splice-token-test-trading-app:Splice.Testing.Apps.TradingApp:OTCTrade';
