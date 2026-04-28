/**
 * Typed wrapper around the `window.canton` provider exposed by Send.
 *
 * Detection is **registry-driven** via `matchesProviderDetection`. The
 * adapter accepts an optional `ProviderDetection` rule set at construction
 * (sourced from the registry's `providerDetection` field for the Send
 * entry); when omitted, it falls back to `SEND_BUILTIN_DETECTION` which
 * mirrors the canonical registry rule. Every public RPC method goes
 * through `guardedRequest`, which checks the live `status` response
 * against those rules before forwarding the call. The result: if a
 * non-Send wallet is sitting at `window.canton`, every Send call resolves
 * to a `SendKernelMismatchError` (treated by the SDK as "Send is not
 * installed"), and Send only ever acts on its own provider.
 */

import { matchesProviderDetection, type ProviderDetection } from '@partylayer/core';

import { SEND_BUILTIN_DETECTION } from './constants';
import { SendKernelMismatchError, SendNotInstalledError } from './errors';
import type {
  SendAccount,
  SendCantonProvider,
  SendEventListener,
  SendEventName,
  SendLedgerApiRequest,
  SendLedgerApiResult,
  SendNetwork,
  SendPrepareExecuteAndWaitResult,
  SendPrepareSubmissionRequest,
  SendRpcMethod,
  SendRpcRequest,
  SendRpcResult,
  SendStatusResponse,
} from './types';

export class SendProvider {
  private readonly detection: ProviderDetection;
  private cachedStatus: SendStatusResponse | null = null;

  /**
   * @param detection Optional. Used to match the running `window.canton`
   *   provider against Send's identity. When omitted, falls back to
   *   `SEND_BUILTIN_DETECTION` (canonical registry rule mirror).
   */
  constructor(detection?: ProviderDetection) {
    this.detection = detection ?? SEND_BUILTIN_DETECTION;
  }

  /**
   * True when `window.canton` is present AND its self-reported status
   * matches Send's detection rules. Performs an actual `status` round-trip
   * on first call and caches the response for subsequent ones.
   */
  async isInstalled(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.canton) return false;
    try {
      const status = await this.fetchStatus();
      return matchesProviderDetection(status, this.detection);
    } catch {
      return false;
    }
  }

  /**
   * Synchronous best-effort presence check. Used for fast picker rendering
   * before any async status introspection. May report `true` for a
   * non-Send provider — callers must follow up with `isInstalled()` (or
   * any guarded request) before assuming Send is wired in.
   */
  isPotentiallyAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.canton;
  }

  /**
   * Read the cached `kernel.id` from the running provider, fetching status
   * on demand. Diagnostic helper kept public for back-compat — detection
   * itself no longer hinges on this single field.
   */
  async getKernelId(): Promise<string> {
    const status = await this.fetchStatus();
    const id = status?.kernel?.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new SendNotInstalledError(
        'window.canton.status() did not return a kernel.id — provider is malformed.',
      );
    }
    return id;
  }

  /**
   * Read the latest cached status object. Resolves the underlying RPC on
   * demand if no cached value is present.
   */
  async getStatus(): Promise<SendStatusResponse> {
    return this.fetchStatus();
  }

  /**
   * Reset the cached status (e.g. after the user uninstalls and reinstalls
   * the extension, or you suspect kernel identity changed mid-session).
   * Kept under both names to avoid breaking existing test imports.
   */
  resetKernelCache(): void {
    this.cachedStatus = null;
  }
  resetStatusCache(): void {
    this.cachedStatus = null;
  }

  private async fetchStatus(): Promise<SendStatusResponse> {
    if (this.cachedStatus) return this.cachedStatus;
    if (typeof window === 'undefined' || !window.canton) {
      throw new SendNotInstalledError();
    }
    const provider = window.canton as SendCantonProvider;
    const status = (await provider.request({ method: 'status' })) as SendStatusResponse;
    this.cachedStatus = status;
    return status;
  }

  /** Internal — bypasses the detection guard. */
  private async rawRequest(args: { method: SendRpcMethod; params?: unknown }): Promise<unknown> {
    if (typeof window === 'undefined' || !window.canton) {
      throw new SendNotInstalledError();
    }
    const provider = window.canton as SendCantonProvider;
    return provider.request(args as SendRpcRequest<SendRpcMethod>);
  }

  /** Public dispatch — guards every call with a registry-driven detection check. */
  private async guardedRequest<M extends SendRpcMethod>(
    args: SendRpcRequest<M>,
  ): Promise<SendRpcResult<M>> {
    const status = await this.fetchStatus();
    if (!matchesProviderDetection(status, this.detection)) {
      const observedId = status?.kernel?.id ?? '<unknown>';
      throw new SendKernelMismatchError(observedId);
    }
    return this.rawRequest(args) as Promise<SendRpcResult<M>>;
  }

  // ── Sigilry RPC methods (every one is guarded) ─────────────────────────

  status(): Promise<SendStatusResponse> {
    return this.guardedRequest({ method: 'status' });
  }

  connect(): Promise<SendStatusResponse> {
    return this.guardedRequest({ method: 'connect' });
  }

  disconnect(): Promise<null> {
    return this.guardedRequest({ method: 'disconnect' });
  }

  isConnected(): Promise<SendStatusResponse> {
    return this.guardedRequest({ method: 'isConnected' });
  }

  getActiveNetwork(): Promise<SendNetwork> {
    return this.guardedRequest({ method: 'getActiveNetwork' });
  }

  listAccounts(): Promise<SendAccount[]> {
    return this.guardedRequest({ method: 'listAccounts' });
  }

  getPrimaryAccount(): Promise<SendAccount> {
    return this.guardedRequest({ method: 'getPrimaryAccount' });
  }

  signMessage(message: string): Promise<{ signature: string }> {
    return this.guardedRequest({ method: 'signMessage', params: { message } });
  }

  prepareExecute(params: SendPrepareSubmissionRequest): Promise<null> {
    return this.guardedRequest({ method: 'prepareExecute', params });
  }

  prepareExecuteAndWait(
    params: SendPrepareSubmissionRequest,
  ): Promise<SendPrepareExecuteAndWaitResult> {
    return this.guardedRequest({ method: 'prepareExecuteAndWait', params });
  }

  ledgerApi(req: SendLedgerApiRequest): Promise<SendLedgerApiResult> {
    return this.guardedRequest({ method: 'ledgerApi', params: req });
  }

  // ── Events ─────────────────────────────────────────────────────────────
  // No kernel guard here on purpose — by the time the dApp wires up an
  // event listener it has already gone through `connect()` (which IS
  // guarded), so we trust the binding.

  on(event: SendEventName, listener: SendEventListener): void {
    if (typeof window === 'undefined' || !window.canton) {
      throw new SendNotInstalledError();
    }
    window.canton.on(event, listener);
  }

  off(event: SendEventName, listener: SendEventListener): void {
    if (typeof window === 'undefined' || !window.canton) return;
    if (typeof window.canton.off === 'function') {
      window.canton.off(event, listener);
      return;
    }
    if (typeof window.canton.removeListener === 'function') {
      window.canton.removeListener(event, listener);
    }
  }
}
