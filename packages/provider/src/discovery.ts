/**
 * CIP-0103 Wallet Discovery
 *
 * Discovers CIP-0103-compliant wallet Providers from the global scope.
 * Wallet-agnostic: no hardcoded wallet logic, only duck-type checking
 * for the Provider interface shape.
 */

import type { CIP0103Provider } from '@partylayer/core';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Metadata about a discovered CIP-0103 wallet provider */
export interface DiscoveredProvider {
  /** Identifier (e.g. "canton.console", "consoleWallet") */
  id: string;
  /** The native CIP-0103 Provider instance */
  provider: CIP0103Provider;
  /** How it was discovered */
  source: 'injected' | 'registry';
  /** Whether the provider supports async flows (userUrl) */
  isAsync?: boolean;
  /** Display name (if discoverable from status) */
  name?: string;
  /** Icon (data: URI or URL) — populated for announce-discovered wallets. */
  icon?: string;
}

// ─── Well-known injection paths ─────────────────────────────────────────────

/**
 * Well-known window property paths where Canton wallet providers
 * may inject themselves.
 *
 * This list is intentionally kept small and generic. New wallets
 * that follow the `window.canton.<wallet>` convention are discovered
 * automatically via namespace scanning.
 */
const KNOWN_INJECTION_PATHS = [
  'canton',
  'cantonWallet',
  'consoleWallet',
  'splice',
] as const;

// ─── Duck-type check ────────────────────────────────────────────────────────

/**
 * Check if an object implements the CIP-0103 Provider interface.
 *
 * This is a structural (duck-type) check — it verifies the presence of
 * the four required methods without checking implementation correctness.
 */
export function isCIP0103Provider(obj: unknown): obj is CIP0103Provider {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.request === 'function' &&
    typeof p.on === 'function' &&
    typeof p.emit === 'function' &&
    typeof p.removeListener === 'function'
  );
}

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover all injected CIP-0103 providers from the global scope.
 *
 * Scans well-known window paths and their sub-properties for objects
 * that implement the Provider interface.
 */
export function discoverInjectedProviders(): DiscoveredProvider[] {
  if (typeof window === 'undefined') return [];

  const discovered: DiscoveredProvider[] = [];
  const seen = new Set<CIP0103Provider>();
  const win = window as unknown as Record<string, unknown>;

  for (const path of KNOWN_INJECTION_PATHS) {
    const candidate = win[path];
    if (candidate === undefined || candidate === null) continue;

    // Direct provider at top level (e.g., window.consoleWallet)
    if (isCIP0103Provider(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      discovered.push({
        id: path,
        provider: candidate,
        source: 'injected',
      });
      continue;
    }

    // Namespace object containing sub-providers
    // (e.g., window.canton.console, window.canton.loop)
    if (typeof candidate === 'object') {
      for (const [key, value] of Object.entries(
        candidate as Record<string, unknown>,
      )) {
        if (isCIP0103Provider(value) && !seen.has(value)) {
          seen.add(value);
          discovered.push({
            id: `${path}.${key}`,
            provider: value,
            source: 'injected',
          });
        }
      }
    }
  }

  return discovered;
}

/**
 * Wait for a specific provider to be injected (with timeout).
 *
 * Extensions may inject their provider after page load. This function
 * polls at 100ms intervals until the provider appears or the timeout
 * expires.
 *
 * @param id - Provider id to match (exact or suffix match)
 * @param timeoutMs - Maximum wait time (default 3000ms)
 */
export function waitForProvider(
  id: string,
  timeoutMs = 3000,
): Promise<DiscoveredProvider | null> {
  return new Promise((resolve) => {
    // Check immediately
    const match = findById(id);
    if (match) {
      resolve(match);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      const match = findById(id);
      if (match) {
        clearInterval(interval);
        resolve(match);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findById(id: string): DiscoveredProvider | undefined {
  return discoverInjectedProviders().find(
    (p) => p.id === id || p.id.endsWith(`.${id}`),
  );
}

// ─── Announce-based discovery (canton:announceProvider) ──────────────────────
//
// Some Canton wallets (notably Send) do NOT reliably expose `window.canton`:
// when another wallet (e.g. Console) owns the single `window.canton` slot, the
// announce wallet is missed by the scan above. Instead they advertise via the
// EIP-6963-style discovery handshake — the same protocol the official
// `@canton-network/dapp-sdk` consumes:
//   1. the dApp dispatches `canton:requestProvider` on `window`;
//   2. each wallet replies with a `canton:announceProvider` CustomEvent whose
//      `detail` carries `{ id/providerId, name, icon, target }`;
//   3. a working provider is built over the extension `target` channel.
//
// Step 3 (the postMessage handshake) is delegated to the official
// `ExtensionAdapter` from `@canton-network/dapp-sdk` rather than reimplemented
// here — it already implements the exact wire protocol, which is the risky part
// to get right on a production path. The factory is injectable so tests can
// substitute a mock provider.

/** Wire event names for the Canton EIP-6963-style provider handshake. */
const CANTON_REQUEST_PROVIDER_EVENT = 'canton:requestProvider';
const CANTON_ANNOUNCE_PROVIDER_EVENT = 'canton:announceProvider';

/** Metadata carried by a `canton:announceProvider` event. */
export interface AnnouncedWallet {
  /** Stable provider id (extension id), e.g. "ldmoh…" for Send. */
  id: string;
  /** Display name. */
  name?: string;
  /** Icon (data: URI or URL). */
  icon?: string;
  /** Routing key for the extension postMessage channel. */
  target?: string;
}

export interface AnnounceDiscoveryOptions {
  /** How long to collect announce replies after the request (ms). Default 300. */
  timeoutMs?: number;
  /**
   * Build a CIP-0103 provider from an announced wallet. Defaults to the
   * official `@canton-network/dapp-sdk` `ExtensionAdapter` (postMessage over
   * the `target` channel). Injectable for tests.
   */
  createProvider?: (
    announced: AnnouncedWallet,
  ) => CIP0103Provider | Promise<CIP0103Provider>;
}

/**
 * Default announce→provider factory: delegates the `target` postMessage
 * handshake to the official `ExtensionAdapter`. Loaded lazily so the dapp-sdk
 * bundle is only pulled in a browser when announce discovery actually runs.
 */
async function defaultAnnounceProvider(
  announced: AnnouncedWallet,
): Promise<CIP0103Provider> {
  const { ExtensionAdapter } = await import('@canton-network/dapp-sdk');
  const adapter = new ExtensionAdapter({
    providerId: announced.id,
    name: announced.name,
    icon: announced.icon,
    target: announced.target,
  });
  // The official Provider has the same four methods as CIP0103Provider.
  return adapter.provider() as unknown as CIP0103Provider;
}

/**
 * Discover wallets that advertise via `canton:announceProvider` (EIP-6963-style).
 *
 * Works regardless of who owns `window.canton` — this is how Send (and
 * Console-via-announce) are found. Each result is a working CIP-0103 provider.
 * Announce replies are deduped by id within a single call.
 */
export async function discoverAnnouncedProviders(
  options: AnnounceDiscoveryOptions = {},
): Promise<DiscoveredProvider[]> {
  if (typeof window === 'undefined') return [];

  const timeoutMs = options.timeoutMs ?? 300;
  const make = options.createProvider ?? defaultAnnounceProvider;

  const announced = new Map<string, AnnouncedWallet>();
  const onAnnounce = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      | Record<string, unknown>
      | undefined;
    if (!detail) return;
    const rawId = detail.providerId ?? detail.id;
    if (typeof rawId !== 'string' || rawId.length === 0) return;
    if (announced.has(rawId)) return; // dedup announce replies by id
    announced.set(rawId, {
      id: rawId,
      name: typeof detail.name === 'string' ? detail.name : undefined,
      icon: typeof detail.icon === 'string' ? detail.icon : undefined,
      target: typeof detail.target === 'string' ? detail.target : undefined,
    });
  };

  window.addEventListener(
    CANTON_ANNOUNCE_PROVIDER_EVENT,
    onAnnounce as EventListener,
  );
  try {
    window.dispatchEvent(new CustomEvent(CANTON_REQUEST_PROVIDER_EVENT));
    await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  } finally {
    window.removeEventListener(
      CANTON_ANNOUNCE_PROVIDER_EVENT,
      onAnnounce as EventListener,
    );
  }

  const results: DiscoveredProvider[] = [];
  for (const wallet of announced.values()) {
    let provider: CIP0103Provider;
    try {
      provider = await make(wallet);
    } catch {
      continue; // a wallet whose provider cannot be built is skipped, not fatal
    }
    if (!isCIP0103Provider(provider)) continue;
    results.push({
      id: wallet.id,
      provider,
      source: 'injected',
      name: wallet.name,
      icon: wallet.icon,
    });
  }
  return results;
}

/**
 * Stable identity for dedup across discovery paths. Prefers the provider's own
 * `id` (extensions report their extension id — Console's `window.canton`
 * provider reports the SAME id it announces with), falling back to the
 * discovery-path id.
 */
function stableProviderId(d: DiscoveredProvider): string {
  const pid = (d.provider as unknown as { id?: unknown }).id;
  return typeof pid === 'string' && pid.length > 0 ? pid : d.id;
}

/**
 * Discover ALL CIP-0103 wallets: the synchronous `window.canton` scan PLUS the
 * `canton:announceProvider` handshake, MERGED and deduped by stable provider id
 * (window.canton results win when a wallet is reachable both ways — e.g.
 * Console announces AND owns `window.canton`, so it appears exactly once).
 *
 * Backward-compatible superset of `discoverInjectedProviders()` (which is left
 * unchanged for existing callers).
 */
export async function discoverProviders(
  options: AnnounceDiscoveryOptions = {},
): Promise<DiscoveredProvider[]> {
  const injected = discoverInjectedProviders();
  const announcedResults = await discoverAnnouncedProviders(options);

  const out: DiscoveredProvider[] = [];
  const seen = new Set<string>();
  // injected first so window.canton wins on duplicate ids
  for (const d of [...injected, ...announcedResults]) {
    const key = stableProviderId(d);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
