/**
 * CIP-0103 Wallet Discovery
 *
 * Discovers CIP-0103-compliant wallet Providers from the global scope.
 * Wallet-agnostic: no hardcoded wallet logic, only duck-type checking
 * for the Provider interface shape.
 */

import type { CIP0103Provider } from '@partylayer/core';
import { createExtensionChannelProvider } from './extension-channel';

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
  /**
   * Whether this entry's STABLE IDENTITY was resolved (additive; A2.1).
   *
   * - announce-discovered entries: always `true` — the announce `id` IS the
   *   wallet's real extension id (canonical provider.md: announce is the
   *   discovery path).
   * - injected (`window.canton` scan) entries: `true` only when a sync
   *   `provider.id` or a `status().provider.id` probe yielded a real id;
   *   `false` when discovery fell back to the path id (an identity-LESS bare
   *   slot, e.g. Console's `{request,on,emit,removeListener,source}` with no id).
   *
   * LIVE INCIDENT (partylayer.xyz post-A2): an identity-less bare slot resolved
   * to the path id `'canton'`; downstream that synthesized a phantom "Canton
   * Wallet" (`browser:ext:canton`) picker entry whose provider was the slot
   * itself. Consumers MUST drop unresolved injected entries rather than list
   * them — correctness must not depend on probe timing.
   */
  identityResolved?: boolean;
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
// Step 3 (the postMessage handshake) is implemented natively in
// extension-channel.ts (mirroring the splice-wallet protocol from
// `@canton-network/core-types`). We do NOT depend on
// `@canton-network/dapp-sdk`'s `ExtensionAdapter`: its single bundled entry
// statically imports `@walletconnect/sign-client` (an uninstalled optional
// peer), which breaks every downstream webpack/Next build that pulls
// `@partylayer/provider` into its graph. The factory is injectable so apps can
// substitute the official adapter (or tests a mock).

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
   * self-contained `createExtensionChannelProvider` (splice postMessage over
   * the `target` channel). Injectable so apps can substitute the official
   * `@canton-network/dapp-sdk` `ExtensionAdapter`, and tests a mock.
   */
  createProvider?: (
    announced: AnnouncedWallet,
  ) => CIP0103Provider | Promise<CIP0103Provider>;
}

/**
 * Default announce→provider factory: a self-contained CIP-0103 provider over
 * the splice-wallet postMessage `target` channel (no external dependency).
 */
function defaultAnnounceProvider(announced: AnnouncedWallet): CIP0103Provider {
  // Canonical contract (provider.md): `target` defaults to `id` when omitted —
  // an announce with no explicit target still routes to the announcing wallet's
  // own channel, never a shared/last-one-wins slot.
  return createExtensionChannelProvider({ target: announced.target ?? announced.id });
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

/** Options for {@link subscribeAnnouncedProviders}. */
export interface AnnounceSubscribeOptions {
  /** Build a CIP-0103 provider from an announce. Defaults to the channel provider. */
  createProvider?: (
    announced: AnnouncedWallet,
  ) => CIP0103Provider | Promise<CIP0103Provider>;
  /** Dispatch `canton:requestProvider` on subscribe to elicit replies (default true). */
  requestOnSubscribe?: boolean;
}

/**
 * PERSISTENT (EIP-6963-style) announce subscription. Mounts a `window` listener
 * for `canton:announceProvider` that stays up until the returned unsubscribe runs.
 * Unlike {@link discoverAnnouncedProviders} (a one-shot snapshot that stops
 * listening after `timeoutMs`), this captures announces that arrive AT ANY TIME —
 * both LATE (slow/late extension injection, after the request window) and announces
 * fired on inject BEFORE this subscription. Dispatches `canton:requestProvider`
 * once on subscribe (unless disabled) to elicit replies. Calls `onProvider` once
 * per newly-announced id (deduped) whose provider builds + passes the CIP-0103
 * shape check.
 *
 * The caller MUST call the returned unsubscribe to remove the listener (no leak).
 */
export function subscribeAnnouncedProviders(
  onProvider: (provider: DiscoveredProvider) => void,
  options: AnnounceSubscribeOptions = {},
): () => void {
  if (typeof window === 'undefined') return () => {};
  const make = options.createProvider ?? defaultAnnounceProvider;
  const seen = new Set<string>();

  const onAnnounce = (event: Event): void => {
    const detail = (event as CustomEvent).detail as
      | Record<string, unknown>
      | undefined;
    if (!detail) return;
    const rawId = detail.providerId ?? detail.id;
    if (typeof rawId !== 'string' || rawId.length === 0) return;
    if (seen.has(rawId)) return; // dedup announce replies by id
    seen.add(rawId);
    const wallet: AnnouncedWallet = {
      id: rawId,
      name: typeof detail.name === 'string' ? detail.name : undefined,
      icon: typeof detail.icon === 'string' ? detail.icon : undefined,
      target: typeof detail.target === 'string' ? detail.target : undefined,
    };
    // Build the provider off the event tick; a wallet whose provider can't be
    // built (or isn't CIP-0103) is skipped, not fatal — mirrors discoverAnnouncedProviders.
    void Promise.resolve()
      .then(() => make(wallet))
      .then((provider) => {
        if (!isCIP0103Provider(provider)) return;
        onProvider({
          id: wallet.id,
          provider,
          source: 'injected',
          name: wallet.name,
          icon: wallet.icon,
        });
      })
      .catch(() => {
        /* unbuildable provider — skip */
      });
  };

  window.addEventListener(
    CANTON_ANNOUNCE_PROVIDER_EVENT,
    onAnnounce as EventListener,
  );
  if (options.requestOnSubscribe !== false) {
    window.dispatchEvent(new CustomEvent(CANTON_REQUEST_PROVIDER_EVENT));
  }
  return () =>
    window.removeEventListener(
      CANTON_ANNOUNCE_PROVIDER_EVENT,
      onAnnounce as EventListener,
    );
}

/** Options for {@link waitForAnnouncedProvider}. */
export interface WaitForAnnouncedOptions extends AnnounceSubscribeOptions {
  /** Max wait before resolving null (default 3000ms). Resolves EARLY on a match. */
  timeoutMs?: number;
}

/**
 * Resolve the FIRST announced provider matching `predicate` the MOMENT it arrives,
 * or `null` after `timeoutMs`. Built on {@link subscribeAnnouncedProviders}, so a
 * LATE announce within the bound is captured (vs a fixed window that returns its
 * snapshot at a fixed time and misses anything later). Auto-unsubscribes on
 * resolve/timeout — no lingering listener.
 */
export function waitForAnnouncedProvider(
  predicate: (provider: DiscoveredProvider) => boolean,
  options: WaitForAnnouncedOptions = {},
): Promise<DiscoveredProvider | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const timeoutMs = options.timeoutMs ?? 3000;
  return new Promise<DiscoveredProvider | null>((resolve) => {
    // const holder so the mutual references (finish ↔ unsubscribe/timer) don't
    // need `let`-assigned-once locals (prefer-const).
    const h: { done: boolean; unsubscribe: () => void; timer?: ReturnType<typeof setTimeout> } = {
      done: false,
      unsubscribe: () => {},
    };
    const finish = (value: DiscoveredProvider | null): void => {
      if (h.done) return;
      h.done = true;
      if (h.timer) clearTimeout(h.timer);
      h.unsubscribe();
      resolve(value);
    };
    h.unsubscribe = subscribeAnnouncedProviders((p) => {
      if (predicate(p)) finish(p);
    }, { createProvider: options.createProvider, requestOnSubscribe: options.requestOnSubscribe });
    h.timer = setTimeout(() => finish(null), timeoutMs);
  });
}

/** Max time to spend on the read-only status() id-probe for ONE injected provider. */
const INJECTED_ID_PROBE_TIMEOUT_MS = 1500;

function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('id-probe timeout')), ms),
    ),
  ]);
}

/**
 * Resolve the stable dedup id for an INJECTED (window.canton scan) entry.
 *
 * Live reality: Console's `window.canton` has NO top-level `id` — its stable id
 * is only available via `status().provider.id` (== its announce id/target). So:
 *   1. use a sync top-level `provider.id` if a provider ever exposes one;
 *   2. else a READ-ONLY `status()` probe reading `result.provider.id` (Console
 *      → "lpnf…", no popup / no signing UI), capped so a non-responsive
 *      injected provider can NEVER block discovery;
 *   3. else fall back to the discovery-path id.
 */
async function resolveInjectedKey(
  d: DiscoveredProvider,
): Promise<{ key: string; resolved: boolean }> {
  const sync = (d.provider as unknown as { id?: unknown }).id;
  if (typeof sync === 'string' && sync.length > 0) return { key: sync, resolved: true };

  try {
    const status = await raceTimeout(
      d.provider.request<{ provider?: { id?: unknown } }>({ method: 'status' }),
      INJECTED_ID_PROBE_TIMEOUT_MS,
    );
    const pid = status?.provider?.id;
    if (typeof pid === 'string' && pid.length > 0) return { key: pid, resolved: true };
  } catch {
    // timeout / throw / non-responsive → fall back to the path id (UNRESOLVED)
  }
  // A2.1: identity-less bare slot — keyed by the path id, but NOT a real identity.
  return { key: d.id, resolved: false };
}

/**
 * Discover ALL CIP-0103 wallets: the synchronous `window.canton` scan PLUS the
 * `canton:announceProvider` handshake, MERGED and deduped by stable provider id.
 *
 * Dedup keys:
 *   - INJECTED entries: resolved via {@link resolveInjectedKey} (sync id →
 *     capped read-only status() probe → path id). Resolved in PARALLEL.
 *   - ANNOUNCE entries: their `d.id` (== announce id == target == the wallet's
 *     `provider.id`). NOT status-probed — an offline announce wallet (e.g. Send)
 *     would otherwise hang up to the channel timeout.
 *
 * INJECTED entries are processed FIRST so the direct `window.canton` provider
 * wins over the announce postMessage shim for a wallet reachable both ways
 * (e.g. Console announces AND owns `window.canton` → appears exactly once).
 *
 * Backward-compatible superset of `discoverInjectedProviders()` (left unchanged).
 */
export async function discoverProviders(
  options: AnnounceDiscoveryOptions = {},
): Promise<DiscoveredProvider[]> {
  const injected = discoverInjectedProviders();
  const announcedResults = await discoverAnnouncedProviders(options);

  // Resolve injected keys in parallel; each probe is independently capped.
  const injectedKeys = await Promise.all(injected.map(resolveInjectedKey));

  const out: DiscoveredProvider[] = [];
  const seen = new Set<string>();

  // INJECTED first — the direct window.canton provider wins on duplicate ids.
  // A2.1: tag identityResolved so consumers can drop identity-less bare slots
  // (which keyed to the path id) instead of synthesizing a phantom entry.
  injected.forEach((d, i) => {
    const { key, resolved } = injectedKeys[i];
    if (seen.has(key)) return;
    seen.add(key);
    // A2.1: when identity RESOLVED, the entry's `id` IS that real provider id —
    // so the SDK identity-bridge matches the right wallet (e.g. Console's bare
    // slot status() → "lpnf…" → bridges to console) instead of the discovery
    // PATH id ("canton") which matches nothing and synthesized the phantom.
    // When UNRESOLVED it keeps the path id and is flagged so consumers drop it.
    out.push({ ...d, id: resolved ? key : d.id, identityResolved: resolved });
  });

  // ANNOUNCE entries keyed by their own id (no status probe → offline-safe).
  // The announce id IS the wallet's real identity (provider.md), so resolved.
  for (const d of announcedResults) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push({ ...d, identityResolved: true });
  }

  return out;
}
