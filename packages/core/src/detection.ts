/**
 * Standards-first CIP-0103 wallet detection.
 *
 * The registry stores `providerDetection` rules per wallet entry. At
 * runtime the picker calls `window.canton.request({method:'status'})`,
 * receives the wallet's self-reported identity (kernel.id / kernel.url /
 * kernel.userUrl / kernel.clientType), and asks `findMatchingWallet`
 * which registry entry — if any — claims this provider.
 *
 * The architecture deliberately avoids hardcoding wallet IDs anywhere
 * outside the registry. Adding a new CIP-0103 wallet to the ecosystem
 * is a registry JSON update; no SDK release is required.
 */

import type {
  ProviderDetection,
  ProviderMatcher,
  WalletInfo,
} from './types';

/**
 * The shape of a CIP-0103 status response that detection cares about.
 *
 * Mirrors what `window.canton.request({ method: 'status' })` returns —
 * declared structurally so adapter packages can reuse this without
 * reaching into the wallet-specific types.
 */
export interface Cip0103StatusForDetection {
  kernel?: {
    id?: string;
    url?: string;
    userUrl?: string;
    clientType?: string;
  };
}

/** Returns true if the runtime status matches any of the detection's matchers. */
export function matchesProviderDetection(
  status: Cip0103StatusForDetection | null | undefined,
  detection: ProviderDetection | undefined,
): boolean {
  if (!status || !detection || !detection.matchers || detection.matchers.length === 0) {
    return false;
  }
  return detection.matchers.some((m) => matchesSingle(status, m));
}

function matchesSingle(status: Cip0103StatusForDetection, matcher: ProviderMatcher): boolean {
  const fieldValue = readField(status, matcher.field);
  if (typeof fieldValue !== 'string' || fieldValue.length === 0) return false;

  switch (matcher.match) {
    case 'exact':
      return matcher.values.includes(fieldValue);
    case 'prefix':
      return fieldValue.startsWith(matcher.value);
    case 'domain':
      return matchesDomain(fieldValue, matcher.value);
    default:
      return false;
  }
}

function readField(
  status: Cip0103StatusForDetection,
  field: ProviderMatcher['field'],
): unknown {
  // Only one nesting level today: `kernel.<key>`.
  const dot = field.indexOf('.');
  if (dot < 0) return undefined;
  const root = field.slice(0, dot);
  const key = field.slice(dot + 1);
  if (root !== 'kernel' || !status.kernel) return undefined;
  return (status.kernel as Record<string, unknown>)[key];
}

/**
 * Matches a URL string against a registrable domain. Subdomain matches
 * are accepted; foreign domains are rejected; un-parseable URLs return
 * false (no exception).
 *
 * Examples:
 *   matchesDomain('https://api-mainnet.cantonwallet.com/x', 'cantonwallet.com') === true
 *   matchesDomain('https://cantonwallet.com',               'cantonwallet.com') === true
 *   matchesDomain('https://other.com',                      'cantonwallet.com') === false
 */
function matchesDomain(url: string, domain: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const target = domain.toLowerCase();
    return hostname === target || hostname.endsWith('.' + target);
  } catch {
    return false;
  }
}

/**
 * Find the first registry entry whose `providerDetection` matches the
 * runtime status. Entries without `providerDetection` are skipped.
 *
 * Accepts either the raw `RegistryWalletEntry[]` shape (registry-client's
 * native input) or the converted `WalletInfo[]` shape that flows through
 * the SDK / React layer — the only field read is `providerDetection`,
 * which both shapes carry post-conversion.
 */
export function findMatchingWallet<
  T extends { providerDetection?: ProviderDetection },
>(status: Cip0103StatusForDetection | null | undefined, registry: readonly T[]): T | undefined {
  if (!status) return undefined;
  for (const entry of registry) {
    if (matchesProviderDetection(status, entry.providerDetection)) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Type-guard convenience for the WalletInfo shape, since the SDK exposes
 * `WalletInfo[]` to React consumers.
 */
export function findMatchingWalletInfo(
  status: Cip0103StatusForDetection | null | undefined,
  wallets: readonly WalletInfo[],
): WalletInfo | undefined {
  return findMatchingWallet(status, wallets);
}

/**
 * Best-effort display name for an unrecognised CIP-0103 provider. Reads
 * the wallet's self-declared `kernel.userUrl` (the human-facing URL
 * surfaced by Sigilry-style wallets) and falls back to `kernel.id` or
 * a generic label.
 */
export function deriveGenericWalletName(status: Cip0103StatusForDetection | null | undefined): string {
  const userUrl = status?.kernel?.userUrl;
  if (typeof userUrl === 'string' && userUrl.length > 0) {
    try {
      return new URL(userUrl).hostname.replace(/^www\./, '');
    } catch {
      /* fall through */
    }
  }
  const id = status?.kernel?.id;
  if (typeof id === 'string' && id.length > 0) {
    return `CIP-0103 wallet (${id.slice(0, 8)}…)`;
  }
  return 'CIP-0103 wallet';
}
