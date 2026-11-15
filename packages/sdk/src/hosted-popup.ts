/** Persistent, origin-bound hosted RPC channel. Wallet wire names are profile data. */
export interface HostedPopupOptions {
  walletUrl: string;
  connectPath: string;
  /** Namespace prefix; each channel owns a distinct nonce-suffixed browser target. */
  popupName: string;
  readyType: string;
  timeoutMs: number;
  popupFeatures: string;
}

export function hostedRpcError(code: number, message: string, data?: unknown): Error & { code: number; data?: unknown } {
  return Object.assign(new Error(message), { code, ...(data === undefined ? {} : { data }) });
}

type Pending = { resolve(value: unknown): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> };
type Handshake = { promise: Promise<void>; resolve(): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> };

export class HostedPopupChannel {
  private readonly origin: string;
  private readonly url: string;
  private popup: Window | null = null;
  private listening = false;
  private ready = false;
  private handshake: Handshake | null = null;
  private pending = new Map<string, Pending>();
  private channelId: string | undefined;
  private nextId = 1;
  private revision = 0;
  private closedTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: HostedPopupOptions) {
    const base = new URL(options.walletUrl);
    if (base.username || base.password || base.hash || base.search || base.origin !== options.walletUrl ||
      !['https:', 'http:'].includes(base.protocol)) throw new Error('Hosted wallet URL must be an exact HTTP(S) origin');
    if (!options.connectPath.startsWith('/') || options.connectPath.startsWith('//')) throw new Error('Hosted wallet path must begin with a single /');
    this.origin = base.origin;
    this.url = new URL(options.connectPath, base).href;
    if (new URL(this.url).origin !== this.origin) throw new Error('Hosted wallet path must remain on the wallet origin');
  }

  get isOpen(): boolean { return !!this.popup && !this.popup.closed && this.ready; }

  /** This method reaches window.open synchronously, before its first await. */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const opened = this.open();
    const revision = this.revision;
    await opened;
    const popup = this.popup;
    if (!popup || popup.closed || !this.ready || revision !== this.revision) throw hostedRpcError(4900, 'Hosted wallet connection closed');
    try { popup.focus(); } catch { /* Browser focus is best effort. */ }
    const id = `${this.identity()}:${this.nextId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.stopClosedMonitorIfIdle();
        reject(hostedRpcError(4900, 'Hosted wallet request timed out'));
      }, this.options.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.monitorClosed();
      try { popup.postMessage({ id, method, ...(params === undefined ? {} : { params }) }, this.origin); }
      catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        this.stopClosedMonitorIfIdle();
        reject(error);
      }
    });
  }

  close(): void {
    ++this.revision;
    this.ready = false;
    const popup = this.popup;
    this.popup = null;
    if (this.listening && typeof window !== 'undefined') window.removeEventListener('message', this.receive);
    this.listening = false;
    this.finishHandshake(hostedRpcError(4900, 'Hosted wallet connection closed'));
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(hostedRpcError(4900, 'Hosted wallet connection closed'));
    }
    this.pending.clear();
    this.stopClosedMonitorIfIdle();
    try { popup?.close(); } catch { /* Cleanup must still reject every waiter. */ }
  }

  private open(): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(hostedRpcError(4100, 'Hosted wallet requires a browser'));
    if (this.isOpen) return Promise.resolve();
    if (this.handshake && this.popup && !this.popup.closed) return this.handshake.promise;
    // An old window cannot retain pending requests when a later call reopens it.
    if (this.popup || this.handshake) this.close();
    if (!this.listening) { window.addEventListener('message', this.receive); this.listening = true; }
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => {
      this.finishHandshake(hostedRpcError(4100, 'Hosted wallet did not become ready'));
      this.close();
    }, this.options.timeoutMs);
    this.handshake = { promise, resolve, reject, timer };
    try { this.popup = window.open(this.url, `${this.options.popupName}-${this.identity()}`, this.options.popupFeatures); }
    catch (error) { this.finishHandshake(error); this.close(); return promise; }
    if (!this.popup) {
      this.finishHandshake(hostedRpcError(4100, 'Hosted wallet popup was blocked'));
      this.close();
    } else this.monitorClosed();
    return promise;
  }

  private readonly receive = (event: MessageEvent): void => {
    if (!this.popup || event.source !== this.popup || event.origin !== this.origin || !event.data || typeof event.data !== 'object') return;
    const message = event.data as Record<string, unknown>;
    if (this.handshake && message.type === this.options.readyType) {
      this.ready = true;
      this.finishHandshake();
      return;
    }
    // The channel nonce prevents cross-instance replies even if a browser target is reused.
    if (typeof message.id !== 'string') return;
    const request = this.pending.get(message.id);
    if (!request) return;
    if (message.error !== undefined && message.error !== null) {
      const error = message.error;
      if (!error || typeof error !== 'object' || typeof (error as { code?: unknown }).code !== 'number' ||
        !Number.isInteger((error as { code: number }).code) || typeof (error as { message?: unknown }).message !== 'string') return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      const rpc = error as { code: number; message: string; data?: unknown };
      request.reject(hostedRpcError(rpc.code, rpc.message, rpc.data));
    } else {
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      request.resolve(message.result);
    }
    this.stopClosedMonitorIfIdle();
  };

  private identity(): string {
    if (!this.channelId) {
      // Created only when opening, so constructing a provider remains SSR safe.
      const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
      this.channelId = Array.from(words, word => word.toString(16).padStart(8, '0')).join('');
    }
    return this.channelId;
  }

  private finishHandshake(error?: unknown): void {
    const handshake = this.handshake;
    if (!handshake) return;
    this.handshake = null;
    clearTimeout(handshake.timer);
    if (error !== undefined) handshake.reject(error); else handshake.resolve();
    this.stopClosedMonitorIfIdle();
  }

  private monitorClosed(): void {
    if (this.closedTimer !== undefined) return;
    this.closedTimer = setInterval(() => { if (this.popup?.closed) this.close(); }, 100);
  }

  private stopClosedMonitorIfIdle(): void {
    if (this.handshake || this.pending.size) return;
    if (this.closedTimer !== undefined) clearInterval(this.closedTimer);
    this.closedTimer = undefined;
  }
}
