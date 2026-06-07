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
  discoverAnnouncedProviders,
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

/** How long to wait for the `canton:announceProvider` reply. */
const DEFAULT_ANNOUNCE_TIMEOUT_MS = 500;

export interface SendProviderOptions {
  /**
   * Pre-resolved channel provider (used by tests). When set, the announce
   * handshake is skipped and every call routes through this provider.
   */
  provider?: CIP0103Provider;
  /** Override the announce-collection window (ms). Default 500. */
  announceTimeoutMs?: number;
  /** Override announce discovery (used by tests). Defaults to the real handshake. */
  discover?: (options?: AnnounceDiscoveryOptions) => Promise<DiscoveredProvider[]>;
}

export class SendProvider {
  private readonly detection: ProviderDetection;
  private readonly announceTimeoutMs: number;
  private readonly discover: (
    options?: AnnounceDiscoveryOptions,
  ) => Promise<DiscoveredProvider[]>;
  private readonly injectedProvider?: CIP0103Provider;

  private cachedChannel: { target: string; provider: CIP0103Provider } | null = null;
  private channelPromise: Promise<{ target: string; provider: CIP0103Provider } | null> | null =
    null;
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
    this.discover = options?.discover ?? ((o) => discoverAnnouncedProviders(o));
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
  private resolveChannel(): Promise<{
    target: string;
    provider: CIP0103Provider;
  } | null> {
    if (this.cachedChannel) return Promise.resolve(this.cachedChannel);
    if (this.channelPromise) return this.channelPromise;

    this.channelPromise = this.doResolveChannel()
      .then((channel) => {
        if (channel) this.cachedChannel = channel;
        return channel;
      })
      .finally(() => {
        this.channelPromise = null;
      });
    return this.channelPromise;
  }

  private async doResolveChannel(): Promise<{
    target: string;
    provider: CIP0103Provider;
  } | null> {
    if (this.injectedProvider) {
      return { target: 'injected', provider: this.injectedProvider };
    }
    if (typeof window === 'undefined') return null;

    const accepted = this.acceptedIds();
    const entries = await this.discover({ timeoutMs: this.announceTimeoutMs });
    const match = entries.find((e) => accepted.includes(e.id));
    if (!match) return null;
    return { target: match.id, provider: match.provider };
  }

  private async channelRequest<T>(
    method: SendRpcMethod,
    params?: unknown,
  ): Promise<T> {
    const channel = await this.resolveChannel();
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
      return (await this.resolveChannel()) !== null;
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
