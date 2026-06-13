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
 * Whether `networkId` normalizes to a recognized, well-known Canton network
 * (mainnet/testnet/devnet/local, in short or CAIP-2 form). `canton:unknown`,
 * other-namespace ids, and unparseable values are NOT recognized.
 *
 * Used by the SDK's discovery-adapter bridge to decide whether a
 * wallet-reported network is trustworthy or should fall back to the dApp's
 * configured network (so an unrecognized report like `canton:unknown` never
 * overrides a known `ctx.network`).
 */
export function isRecognizedNetwork(networkId: string): boolean {
  try {
    return KNOWN_CAIP2.has(toCAIP2Network(networkId).networkId);
  } catch {
    return false;
  }
}

/**
 * Detect a DIFFERENT-network mismatch between an `expected` (dApp-configured)
 * and `actual` (wallet-reported) network.
 *
 * Rule: normalize both (short→CAIP-2 where possible), then compare.
 *   - EQUAL  → `null` (no mismatch) — same network, INCLUDING two equal
 *     unrecognized values (e.g. both `canton:unknown`). This protects a
 *     legitimate same-network restore from a false positive.
 *   - UNEQUAL → mismatch. This INCLUDES a recognized network vs an
 *     unrecognized-but-different one (e.g. `canton:da-mainnet` vs
 *     `canton:unknown`): we do NOT fail open. A wallet reporting an unknown
 *     network that differs from the dApp's configured network is treated as a
 *     mismatch (refused under enforcement), not silently accepted.
 *
 * Unparseable inputs fall back to a RAW string comparison (same equality rule),
 * so an exotic-but-different network can never slip through as "no mismatch".
 *
 * NOTE: this is intentionally stricter than the prior behavior, which returned
 * `null` whenever either side was not a well-known CAIP-2 id (a fail-open that
 * let a wallet on an unknown network silently restore/transact against a
 * different configured network — the `canton:unknown` case observed with
 * popup/remote wallets). The SDK feeds this a recognized network on the normal
 * path (see the bridge's network capture), so the legitimate same-network flow
 * stays silent.
 */
export function detectNetworkMismatch(
  expected: string,
  actual: string,
): { expected: string; actual: string } | null {
  const normalize = (v: string): string => {
    try {
      return toCAIP2Network(v).networkId;
    } catch {
      return v; // unparseable → compare raw (never fail open on difference)
    }
  };
  const ne = normalize(expected);
  const na = normalize(actual);
  return ne === na ? null : { expected: ne, actual: na };
}
