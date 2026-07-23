/**
 * App-level view models for the DvP example.
 *
 * The CIP-0056 shapes (holdings, allocations, allocation requests, transfer legs)
 * come straight from `@partylayer/react/query`; only the demo-specific types live
 * here.
 */

/** The three demo parties: the settlement venue and the two counterparties. */
export type DemoPartyKey = 'venue' | 'alice' | 'bob';

export interface DemoParty {
  key: DemoPartyKey;
  label: string;
  /** The party id string (Daml `Party`). */
  partyId: string;
}

/** A demo instrument: the registry-administered asset a leg transfers. */
export interface InstrumentConfig {
  admin: string;
  id: string;
  name: string;
}

/** Variables for the venue's atomic settle, exercised through the generic useChoice. */
export interface SettleTrade {
  requestCid: string;
}

/** Variables for the venue creating a new trade (its own settlement-app choice). */
export interface CreateTrade {
  usdAmount: string;
  bondAmount: string;
}
