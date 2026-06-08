/**
 * CAIP-2 Network Identity Utilities
 *
 * All CIP-0103 network identifiers use CAIP-2 format: "namespace:reference"
 * e.g. "canton:da-mainnet", "canton:da-devnet"
 *
 * Reference: https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
 */

import type { CIP0103Network } from './cip0103-types';

// ─── Well-known Canton CAIP-2 Network IDs ───────────────────────────────────

export const CANTON_NETWORKS: Record<string, string> = {
  mainnet: 'canton:da-mainnet',
  testnet: 'canton:da-testnet',
  devnet: 'canton:da-devnet',
  local: 'canton:da-local',
};

// ─── Reverse lookup ─────────────────────────────────────────────────────────

const CAIP2_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(CANTON_NETWORKS).map(([short, full]) => [full, short]),
);

/**
 * Convert a legacy PartyLayer NetworkId (e.g. "devnet") or already-CAIP-2
 * string to a CIP-0103 Network object.
 *
 * @throws {Error} if the resulting network ID is not valid CAIP-2
 */
export function toCAIP2Network(networkId: string): CIP0103Network {
  let result: string;

  if (networkId.includes(':')) {
    // Already CAIP-2 format
    result = networkId;
  } else {
    // Map well-known short names
    const caip2 = CANTON_NETWORKS[networkId];
    result = caip2 ?? `canton:${networkId}`;
  }

  if (!isValidCAIP2(result)) {
    throw new Error(
      `Invalid CAIP-2 network identifier: "${result}". Expected format: "namespace:reference"`,
    );
  }

  return { networkId: result };
}

/**
 * Extract the short network name from a CAIP-2 ID.
 * Returns the original string if no reverse mapping exists.
 */
export function fromCAIP2Network(caip2: string): string {
  const short = CAIP2_TO_SHORT[caip2];
  if (short) return short;

  // Extract reference part after ':'
  const colonIndex = caip2.indexOf(':');
  return colonIndex >= 0 ? caip2.slice(colonIndex + 1) : caip2;
}

/**
 * Validate that a string conforms to CAIP-2 format.
 *
 * CAIP-2 format: namespace:reference
 * - namespace: [-a-z0-9]{3,8}
 * - reference: [-_a-zA-Z0-9]{1,32}
 */
export function isValidCAIP2(networkId: string): boolean {
  return /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/.test(networkId);
}

// ─── Network mismatch detection ─────────────────────────────────────────────

/** The recognized, well-known Canton CAIP-2 ids (e.g. canton:da-mainnet). */
const KNOWN_CAIP2 = new Set(Object.values(CANTON_NETWORKS));

/**
 * Detect a confident, recognized, DIFFERENT-network mismatch between an
 * `expected` (dApp-configured) and `actual` (wallet-reported) network.
 *
 * Conservative by design — returns `null` (no mismatch) unless BOTH networks
 * normalize to recognized well-known Canton CAIP-2 ids AND differ. Unparseable
 * or unrecognized/custom networks → `null` (never a false positive).
 */
export function detectNetworkMismatch(
  expected: string,
  actual: string,
): { expected: string; actual: string } | null {
  let ne: string;
  let na: string;
  try {
    ne = toCAIP2Network(expected).networkId;
    na = toCAIP2Network(actual).networkId;
  } catch {
    return null;
  }
  if (!KNOWN_CAIP2.has(ne) || !KNOWN_CAIP2.has(na)) return null; // unrecognized/custom → skip
  return ne === na ? null : { expected: ne, actual: na };
}
