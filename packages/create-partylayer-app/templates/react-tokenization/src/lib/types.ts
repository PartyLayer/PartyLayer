/**
 * App-level view models for the Tokenization example.
 *
 * The holding, allocation, and pending-instruction shapes now come straight from
 * `@partylayer/react/query` as the corrected contract-ref types
 * (`TokenHoldingRef`, `TokenAllocationRef`, `TokenTransferInstructionRef`), so the
 * app no longer defines its own ref or instruction models. Only the demo-specific
 * types remain here.
 */

/** The three demo parties this example switches between. */
export type DemoPartyKey = 'issuer' | 'alice' | 'bob';

export interface DemoParty {
  key: DemoPartyKey;
  label: string;
  /** The party id string (Daml `Party`). */
  partyId: string;
}

/** A small instrument-config view read through the generic `useDamlContract`. */
export interface InstrumentConfig {
  admin: string;
  id: string;
  name: string;
  description: string;
}
