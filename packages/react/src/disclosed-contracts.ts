/**
 * @partylayer/react: disclosed contract and choice context wire shapes.
 *
 * Framework-free types and ONE pure function (zero React, zero TanStack) for the
 * typed wire shapes every CIP-0056 registry flow carries: the disclosed contracts a
 * choice needs, the choice context that references them, and the factory-with-context
 * a registry returns for a transfer or an allocation. Mirrored byte-faithfully from
 * the official Canton token standard OpenAPI (the transfer-instruction and
 * allocation-instruction specs), whose schemas keep these definitions self-contained
 * per API; the required and optional split on each type mirrors the schemas' own
 * required lists.
 *
 * Nothing here imports anything: no sibling modules, no runtime dependency, so the
 * module stays importable anywhere the wire shapes are handled.
 */

/**
 * A contract disclosed to the participant node so a choice can reference off-ledger
 * reference data by contract id. Mirrors the token standard `DisclosedContract`
 * schema.
 *
 * `synchronizerId` is the synchronizer the contract is currently assigned to; if the
 * contract is in the process of being reassigned, the registry returns a `409`.
 *
 * The `debug` fields are provider hints and are the schema's only optional members:
 * trust them ONLY if you trust the provider, as they may not match the data in the
 * `createdEventBlob`.
 */
export interface TokenDisclosedContract {
  templateId: string;
  contractId: string;
  createdEventBlob: string;
  /**
   * The synchronizer to which the contract is currently assigned. If the contract is
   * in the process of being reassigned, the registry returns a `409` response.
   */
  synchronizerId: string;
  /**
   * The name of the Daml package that was used to create the contract. Use this only
   * if you trust the provider, as it might not match the data in the
   * `createdEventBlob`.
   */
  debugPackageName?: string;
  /**
   * The contract arguments that were used to create the contract. Use this only if
   * you trust the provider, as it might not match the data in the `createdEventBlob`.
   */
  debugPayload?: Record<string, unknown>;
  /**
   * The ledger effective time at which the contract was created. Use this only if you
   * trust the provider, as it might not match the data in the `createdEventBlob`.
   */
  debugCreatedAt?: string;
}

/**
 * The context required to exercise a choice on a contract via an interface. The
 * additional reference data arrives as disclosed contracts, referred to by contract
 * id from within `choiceContextData`. Mirrors the token standard `ChoiceContext`
 * schema.
 */
export interface TokenChoiceContext {
  choiceContextData: Record<string, unknown>;
  disclosedContracts: TokenDisclosedContract[];
}

/**
 * A transfer factory contract together with the choice context required to exercise
 * its choice. Mirrors the transfer-instruction `TransferFactoryWithChoiceContext`
 * schema.
 *
 * Clients SHOULD NOT reuse one factory-with-context for exercising multiple choices,
 * since the choice context MAY be specific to the choice being exercised.
 *
 * `transferKind` selects the workflow:
 * - `offer`: offer a transfer to the receiver and only transfer if they accept;
 * - `direct`: transfer directly to the receiver without asking for approval, chosen
 *   only when the receiver has pre-approved direct transfers;
 * - `self`: a self-transfer where the sender and receiver are the same party, needing
 *   no approval and typically immediate.
 */
export interface TokenTransferFactory {
  factoryId: string;
  transferKind: 'offer' | 'direct' | 'self';
  choiceContext: TokenChoiceContext;
}

/**
 * An allocation factory contract together with the choice context required to
 * exercise its choice. Mirrors the allocation-instruction `FactoryWithChoiceContext`
 * schema (the allocation sibling of {@link TokenTransferFactory}, with no
 * `transferKind`).
 *
 * Clients SHOULD NOT reuse one factory-with-context for exercising multiple choices,
 * since the choice context MAY be specific to the choice being exercised.
 */
export interface TokenAllocationFactory {
  factoryId: string;
  choiceContext: TokenChoiceContext;
}

/**
 * Merge disclosed contract lists into one submission's disclosed contracts.
 *
 * Flattens the inputs in order and deduplicates by `contractId` with the FIRST
 * occurrence winning and order otherwise stable. Entries sharing a `contractId`
 * represent the same created event, so first wins is safe. Use this when combining
 * the disclosures of multiple registry contexts (for example a factory context plus a
 * per action choice context) into one submission's disclosed contracts.
 */
export function mergeDisclosedContracts(
  ...lists: Array<TokenDisclosedContract[] | undefined>
): TokenDisclosedContract[] {
  const out: TokenDisclosedContract[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const entry of list) {
      if (seen.has(entry.contractId)) continue;
      seen.add(entry.contractId);
      out.push(entry);
    }
  }
  return out;
}
