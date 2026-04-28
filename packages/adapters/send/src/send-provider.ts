/**
 * Typed wrapper around the `window.canton` provider exposed by Send.
 *
 * Every public method (except `isInstalled` / `isPotentiallyAvailable` /
 * `getKernelId` itself) goes through `guardedRequest`, which verifies the
 * provider's `kernel.id` matches Send's Chrome extension ID before
 * forwarding the call. This keeps the Send adapter from claiming a
 * foreign provider — if a Console-spec wallet (or any other splice-
 * wallet-kernel-compatible extension) is the one currently sitting at
 * `window.canton`, every Send call resolves to a `SendKernelMismatchError`
 * which the SDK treats as "Send is not installed."
 */

import { SEND_KERNEL_ID } from './constants';
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
  private cachedKernelId: string | null = null;

  /**
   * True only when `window.canton` is present AND its `kernel.id` matches
   * Send. Performs an actual `status` round-trip on first call and caches
   * the result for subsequent ones.
   */
  async isInstalled(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.canton) return false;
    try {
      const kernelId = await this.getKernelId();
      return kernelId === SEND_KERNEL_ID;
    } catch {
      return false;
    }
  }

  /**
   * Synchronous best-effort presence check. Used for fast picker rendering
   * before any async kernel introspection. May report `true` for a
   * non-Send provider — callers must follow up with `isInstalled()` (or
   * any guarded request) before assuming Send is wired in.
   */
  isPotentiallyAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.canton;
  }

  /**
   * Read `kernel.id` from the running provider. Bypasses the kernel guard
   * so it can be used to populate the cache.
   */
  async getKernelId(): Promise<string> {
    if (this.cachedKernelId) return this.cachedKernelId;
    const status = (await this.rawRequest({ method: 'status' })) as SendStatusResponse;
    const id = status?.kernel?.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new SendNotInstalledError(
        'window.canton.status() did not return a kernel.id — provider is malformed.',
      );
    }
    this.cachedKernelId = id;
    return this.cachedKernelId;
  }

  /**
   * Reset the cached kernel id. Useful in tests, or after a wallet
   * extension is uninstalled / reinstalled mid-session.
   */
  resetKernelCache(): void {
    this.cachedKernelId = null;
  }

  /** Internal — bypasses the kernel guard. Used only by `getKernelId`. */
  private async rawRequest(args: { method: SendRpcMethod; params?: unknown }): Promise<unknown> {
    if (typeof window === 'undefined' || !window.canton) {
      throw new SendNotInstalledError();
    }
    const provider = window.canton as SendCantonProvider;
    return provider.request(args as SendRpcRequest<SendRpcMethod>);
  }

  /** Public dispatch — guards every call with a kernel.id check. */
  private async guardedRequest<M extends SendRpcMethod>(
    args: SendRpcRequest<M>,
  ): Promise<SendRpcResult<M>> {
    const kernelId = await this.getKernelId();
    if (kernelId !== SEND_KERNEL_ID) {
      throw new SendKernelMismatchError(kernelId);
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
