/**
 * Symmetric party mapping for the live gateway. The apps speak in party KEYS
 * (alice, bob, venue, issuer); the ledger speaks in full party ids. Requests are
 * translated key to ledger id on the way in (see `partyId` in live/backend.ts);
 * this module translates ledger id back to key on the way out for the fields the
 * apps compare (leg sender and receiver, allocation owner), so the app can compare
 * keys in both demo and live. The raw ledger id is kept in the payload under a
 * clearly named field (senderLedgerId / receiverLedgerId) so nothing is hidden.
 *
 * Pure and framework-free, so it is unit tested directly on fixtures.
 */

/** A leg shape carrying party ids, with optional room for the raw ledger ids. */
export interface MappableLeg {
  sender: string;
  receiver: string;
  senderLedgerId?: string;
  receiverLedgerId?: string;
}

/**
 * Build a reverse resolver from a key to ledger id map (P). Unknown ids pass
 * through unchanged, so a party the map does not know (or a value already a key)
 * is never lost. When two keys share a ledger id (issuer and venue both map to the
 * venue party on Amulet), the FIRST key in P wins, which is why P should list the
 * semantically preferred key first for a shared id.
 */
export function makeToKey(keyToLedgerId: Record<string, string>): (id: string) => string {
  const ledgerIdToKey = new Map<string, string>();
  for (const [key, ledgerId] of Object.entries(keyToLedgerId)) {
    if (!ledgerIdToKey.has(ledgerId)) ledgerIdToKey.set(ledgerId, key);
  }
  return (id: string): string => ledgerIdToKey.get(id) ?? id;
}

/**
 * Forward resolver: a key to its ledger id. Unknown values (already a ledger id,
 * or a party the map does not know) pass through unchanged. This is the inbound
 * half of the symmetric map; the gateway uses it for every submitted party field.
 */
export function makeToLedgerId(keyToLedgerId: Record<string, string>): (key: string) => string {
  return (key: string): string => keyToLedgerId[key] ?? key;
}

/**
 * Return a copy of a leg with sender and receiver mapped to keys, keeping the raw
 * ledger ids under senderLedgerId / receiverLedgerId. Idempotent for values that
 * are already keys (they pass through and their own id is recorded).
 */
export function reverseLeg<T extends MappableLeg>(
  leg: T,
  toKey: (id: string) => string,
): T & { senderLedgerId: string; receiverLedgerId: string } {
  return {
    ...leg,
    sender: toKey(leg.sender),
    receiver: toKey(leg.receiver),
    senderLedgerId: leg.sender,
    receiverLedgerId: leg.receiver,
  };
}
