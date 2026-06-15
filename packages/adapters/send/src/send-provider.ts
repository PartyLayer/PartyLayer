/**
 * Typed wrapper around the Send Canton wallet, reached via the
 * `canton:announceProvider` + extension postMessage `target` channel.
 *
 * WHY NOT `window.canton`: Send is announce-only. When another wallet (e.g.
 * Console) owns the single shared `window.canton` slot, the old transport
 * (bind `window.canton`, guard by `kernel.id`) returned a kernel mismatch and
 * Send was unconnectable. Send instead fires `canton:announceProvider` with
 * `{ id, name, icon, target }` (id == target == its extension id) and does NOT
 * inject `window.canton`. So detection + every RPC now go through the announce
 * handshake and the splice postMessage `target` channel, regardless of who
 * owns `window.canton`.
 *
 * Transport is reused from `@partylayer/provider`: `discoverAnnouncedProviders`
 * finds Send's announce entry (a ready `createExtensionChannelProvider` over
 * its `target`), and every call is forwarded through that channel provider's
 * request/response. Detection is registry-driven: the announce `id` is matched
 * against Send's accepted extension ids (the `provider.id` matchers of the
 * supplied `ProviderDetection`, plus `SEND_KNOWN_EXTENSION_IDS`).
 *
 * INBOUND EVENTS: the official splice extension (sync) provider does not push
 * events over `postMessage` — the wire protocol has no inbound-event message
 * type, and event push exists only on the remote/SSE path. Send's tx result
 * comes from `prepareExecuteAndWait`'s response, not from `txChanged`. So
 * `on`/`off` simply delegate to the channel provider's local event bus (kept so
 * the `events` capability and API are preserved); they never throw.
 */

import type {
  CIP0103EventListener,
  CIP0103Provider,
  CIP0103RequestPayload,
  ProviderDetection,
} from '@partylayer/core';
import {
  waitForAnnouncedProvider,
  type WaitForAnnouncedOptions,
  type AnnounceDiscoveryOptions,
  type DiscoveredProvider,
} from '@partylayer/provider';

import { SEND_BUILTIN_DETECTION, SEND_KNOWN_EXTENSION_IDS } from './constants';
import { SendNotInstalledError } from './errors';
import type {
  SendAccount,
  SendEventListener,
  SendEventName,
  SendLedgerApiRequest,
  SendLedgerApiResult,
  SendNetwork,
  SendPrepareExecuteAndWaitResult,
  SendPrepareSubmissionRequest,
  SendRpcMethod,
  SendStatusResponse,
} from './types';

// Split bounds, mirroring the EIP-6963 reference model (wagmi/mipd): readiness
// is REACTIVE (a persistent listener, here the SDK client's announce
// accumulator), and only a DELIBERATE one-shot action blocks for long.
//
// CONNECT path — a deliberate user action ("connect to Send") with a clear
// "not installed" failure. Resolve-on-arrival has NO latency penalty when Send
// announces promptly; the full bound is only spent when Send is genuinely
// absent, and it tolerates a slow/late extension injection up to 3s.
const DEFAULT_ANNOUNCE_TIMEOUT_MS = 3000;
// DETECT path (isInstalled / detectInstalled) — best-effort readiness for a
// per-wallet indicator. Must NOT stall the UI for seconds when Send is absent,
// so it is short. The client's persistent accumulator is the real safety net: a
// late announce (>detect bound) is still captured there and self-corrects
// listWallets(); connect (3s) then still succeeds. 1000ms catches the common
// sub-1s late inject without the multi-second stall a shared 3s bound would add.
const DEFAULT_DETECT_TIMEOUT_MS = 1000;

export interface SendProviderOptions {
  /**
   * Pre-resolved channel provider (used by tests). When set, the announce
   * handshake is skipped and every call routes through this provider.
   */
  provider?: CIP0103Provider;
  /**
   * Max wait for Send's announce on the CONNECT/request path (ms); resolves
   * EARLY on arrival. A deliberate action, so this is generous. Default 3000.
   */
  announceTimeoutMs?: number;
  /**
   * Max wait for Send's announce on the DETECT path (`isInstalled`) (ms);
   * resolves EARLY on arrival. Best-effort readiness, so this is short — the
   * client's persistent accumulator catches anything later. Default 1000.
   */
  detectTimeoutMs?: number;
  /** Override announce resolution (resolve-on-arrival). Defaults to the real handshake. */
  waitForProvider?: (
    predicate: (p: DiscoveredProvider) => boolean,
    options?: WaitForAnnouncedOptions,
  ) => Promise<DiscoveredProvider | null>;
  /**
   * @deprecated Use {@link SendProviderOptions.waitForProvider} (resolve-on-arrival).
   * Legacy one-shot snapshot hook — still honored (wrapped as find-first) for
   * backward compatibility; superseded because a fixed window can miss a late
   * announce. Ignored when `waitForProvider` is also supplied.
   */
  discover?: (options?: AnnounceDiscoveryOptions) => Promise<DiscoveredProvider[]>;
}

export class SendProvider {
  private readonly detection: ProviderDetection;
  private readonly announceTimeoutMs: number;
  private readonly detectTimeoutMs: number;
  private readonly waitForProvider: (
    predicate: (p: DiscoveredProvider) => boolean,
    options?: WaitForAnnouncedOptions,
  ) => Promise<DiscoveredProvider | null>;
  private readonly injectedProvider?: CIP0103Provider;

  private cachedChannel: { target: string; provider: CIP0103Provider } | null = null;
  private channelPromise: Promise<{ target: string; provider: CIP0103Provider } | null> | null =
    null;
  /** Bound the in-flight `channelPromise` was started with (for bound-aware dedup). */
  private channelPromiseTimeoutMs = 0;
  private cachedStatus: SendStatusResponse | null = null;

  /**
   * @param detection Optional registry `ProviderDetection`. Its `provider.id`
   *   exact-match values define which announced extension ids are treated as
   *   Send. Defaults to `SEND_BUILTIN_DETECTION`.
   * @param options Optional test/advanced hooks (see {@link SendProviderOptions}).
   */
  constructor(detection?: ProviderDetection, options?: SendProviderOptions) {
    this.detection = detection ?? SEND_BUILTIN_DETECTION;
    this.announceTimeoutMs = options?.announceTimeoutMs ?? DEFAULT_ANNOUNCE_TIMEOUT_MS;
    this.detectTimeoutMs = options?.detectTimeoutMs ?? DEFAULT_DETECT_TIMEOUT_MS;
    // Resolve-on-arrival seam. Precedence: explicit waitForProvider > the legacy
    // one-shot `discover` (wrapped as find-first, backward-compat) > the default
    // persistent handshake.
    if (options?.waitForProvider) {
      this.waitForProvider = options.waitForProvider;
    } else if (options?.discover) {
      const legacy = options.discover;
      this.waitForProvider = (pred, o) =>
        legacy({ timeoutMs: o?.timeoutMs }).then((entries) => entries.find(pred) ?? null);
    } else {
      this.waitForProvider = (pred, o) => waitForAnnouncedProvider(pred, o);
    }
    this.injectedProvider = options?.provider;
  }

  /** Extension ids accepted as Send: registry `provider.id` matchers ∪ known ids. */
  private acceptedIds(): string[] {
    const fromDetection = this.detection.matchers
      .filter((m) => m.field === 'provider.id' && m.match === 'exact')
      .flatMap((m) => (m as { values: string[] }).values);
    return Array.from(new Set([...fromDetection, ...SEND_KNOWN_EXTENSION_IDS]));
  }

  /**
   * Resolve (and cache) Send's announce channel. Returns null if Send did not
   * announce. Concurrent callers share a single in-flight announce (dedup), so
   * a burst of requests triggers exactly one handshake.
   */
  private resolveChannel(timeoutMs: number): Promise<{
    target: string;
    provider: CIP0103Provider;
  } | null> {
    if (this.cachedChannel) return Promise.resolve(this.cachedChannel);
    // Reuse an in-flight handshake only if its bound is at least as generous as
    // this caller needs — so a quick detect probe (1000ms) in flight never
    // shortens a connect's full 3000ms budget. A longer-bound caller starts its
    // own resolve; both only ever set the SAME cachedChannel on success, and a
    // resolved channel is shared, so the shorter probe still benefits.
    if (this.channelPromise && this.channelPromiseTimeoutMs >= timeoutMs) {
      return this.channelPromise;
    }

    const p: Promise<{ target: string; provider: CIP0103Provider } | null> = this.doResolveChannel(
      timeoutMs,
    )
      .then((channel) => {
        if (channel) this.cachedChannel = channel;
        return channel;
      })
      .finally(() => {
        // Only clear if WE are still the current in-flight promise (a
        // longer-bound caller may have replaced us; let it own teardown).
        if (this.channelPromise === p) {
          this.channelPromise = null;
          this.channelPromiseTimeoutMs = 0;
        }
      });
    this.channelPromise = p;
    this.channelPromiseTimeoutMs = timeoutMs;
    return p;
  }

  private async doResolveChannel(timeoutMs: number): Promise<{
    target: string;
    provider: CIP0103Provider;
  } | null> {
    if (this.injectedProvider) {
      return { target: 'injected', provider: this.injectedProvider };
    }
    if (typeof window === 'undefined') return null;

    const accepted = this.acceptedIds();
    // Resolve-on-arrival: returns the instant Send announces a matching id, up
    // to announceTimeoutMs — so a LATE announce (slow extension inject) is caught,
    // not missed by a fixed window. null → Send did not announce within the bound.
    const match = await this.waitForProvider((e) => accepted.includes(e.id), {
      timeoutMs,
    });
    if (!match) return null;
    return { target: match.id, provider: match.provider };
  }

  private async channelRequest<T>(
    method: SendRpcMethod,
    params?: unknown,
  ): Promise<T> {
    // Connect/request path — deliberate action, generous bound.
    const channel = await this.resolveChannel(this.announceTimeoutMs);
    if (!channel) throw new SendNotInstalledError();
    const payload = (
      params === undefined ? { method } : { method, params }
    ) as CIP0103RequestPayload;
    return channel.provider.request<T>(payload);
  }

  // ── Detection ────────────────────────────────────────────────────────────

  /**
   * True iff Send announces via `canton:announceProvider` — independent of who
   * owns `window.canton`. Caches the resolved channel.
   */
  async isInstalled(): Promise<boolean> {
    try {
      // Detect path — best-effort readiness, short bound (the SDK client's
      // persistent accumulator catches any later announce and self-corrects).
      return (await this.resolveChannel(this.detectTimeoutMs)) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous best-effort presence check: only that we are in a browser where
   * announce discovery can run. The authoritative check is `isInstalled()` /
   * any request (which performs the announce handshake). No longer depends on
   * the shared `window.canton` slot.
   */
  isPotentiallyAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Read `status().kernel.id`. Diagnostic helper kept for back-compat. Live
   * Send no longer reports a kernel; this throws `SendNotInstalledError` when
   * absent (callers that need the stable id should use the announce target).
   */
  async getKernelId(): Promise<string> {
    const status = await this.fetchStatus();
    const id = status?.kernel?.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new SendNotInstalledError(
        'Send status() did not return a kernel.id.',
      );
    }
    return id;
  }

  /** Latest status (cached after first fetch). */
  async getStatus(): Promise<SendStatusResponse> {
    return this.fetchStatus();
  }

  /** Reset cached status AND the resolved announce channel (forces re-announce). */
  resetKernelCache(): void {
    this.cachedStatus = null;
    this.cachedChannel = null;
    this.channelPromise = null;
  }
  resetStatusCache(): void {
    this.cachedStatus = null;
    this.cachedChannel = null;
    this.channelPromise = null;
  }

  private async fetchStatus(): Promise<SendStatusResponse> {
    if (this.cachedStatus) return this.cachedStatus;
    const status = await this.channelRequest<SendStatusResponse>('status');
    this.cachedStatus = status;
    return status;
  }

  // ── Sigilry RPC methods (all over the announce target channel) ────────────

  status(): Promise<SendStatusResponse> {
    return this.channelRequest('status');
  }

  connect(): Promise<SendStatusResponse> {
    return this.channelRequest('connect');
  }

  disconnect(): Promise<null> {
    return this.channelRequest('disconnect');
  }

  isConnected(): Promise<SendStatusResponse> {
    return this.channelRequest('isConnected');
  }

  getActiveNetwork(): Promise<SendNetwork> {
    return this.channelRequest('getActiveNetwork');
  }

  listAccounts(): Promise<SendAccount[]> {
    return this.channelRequest('listAccounts');
  }

  getPrimaryAccount(): Promise<SendAccount> {
    return this.channelRequest('getPrimaryAccount');
  }

  signMessage(message: string): Promise<{ signature: string }> {
    return this.channelRequest('signMessage', { message });
  }

  prepareExecute(params: SendPrepareSubmissionRequest): Promise<null> {
    return this.channelRequest('prepareExecute', params);
  }

  prepareExecuteAndWait(
    params: SendPrepareSubmissionRequest,
  ): Promise<SendPrepareExecuteAndWaitResult> {
    return this.channelRequest('prepareExecuteAndWait', params);
  }

  ledgerApi(req: SendLedgerApiRequest): Promise<SendLedgerApiResult> {
    return this.channelRequest('ledgerApi', req);
  }

  // ── Events ─────────────────────────────────────────────────────────────
  // Delegated to the channel provider's local event bus. By the time a dApp
  // wires up a listener it has already gone through connect(), so the channel
  // is cached. The official extension (sync) provider has no postMessage event
  // push either, so this preserves the API/`events` capability without
  // inventing a non-existent wire shape; it never throws.

  on(event: SendEventName, listener: SendEventListener): void {
    const channel = this.cachedChannel;
    if (!channel) return;
    channel.provider.on(event, listener as CIP0103EventListener);
  }

  off(event: SendEventName, listener: SendEventListener): void {
    const channel = this.cachedChannel;
    if (!channel) return;
    channel.provider.removeListener(event, listener as CIP0103EventListener);
  }
}
