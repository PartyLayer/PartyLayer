/**
 * SSE stream helpers for the Cauri gateway (`GET /api/dapp/events`).
 *
 * The gateway pushes CIP-103 provider events over Server-Sent Events keyed
 * by a session token. The adapter surfaces `txChanged` to its own event
 * emitter and awaits the first `accountsChanged` after connect approval.
 */

export interface AccountsChangedEvent {
  primary: boolean;
  partyId: string;
  status: string;
  hint: string;
  publicKey: string;
  namespace: string;
  networkId: string;
}

export interface TxChangedEvent {
  status: 'pending' | 'signed' | 'executed' | 'failed';
  commandId: string;
  payload?: { updateId?: string; completionOffset?: number };
}

export interface StatusChangedEvent {
  status: string;
  reason?: string;
}

export interface StreamHandlers {
  onTxChanged?: (ev: TxChangedEvent) => void;
  onStatusChanged?: (ev: StatusChangedEvent) => void;
  onError?: () => void;
}

export interface StreamHandle {
  readonly source: EventSource;
  close(): void;
}

export function openStream(
  apiBase: string,
  sessionToken: string,
  handlers: StreamHandlers,
): StreamHandle {
  const url = `${apiBase}/api/dapp/events?token=${encodeURIComponent(sessionToken)}`;
  const source = new EventSource(url);

  bindJsonEvent(source, 'txChanged', handlers.onTxChanged);
  bindJsonEvent(source, 'statusChanged', handlers.onStatusChanged);
  source.onerror = () => handlers.onError?.();

  return {
    source,
    close: () => source.close(),
  };
}

// Malformed payloads are swallowed here; a systemic parse failure surfaces
// via the caller's onError.
function bindJsonEvent<T>(
  source: EventSource,
  name: string,
  cb: ((ev: T) => void) | undefined,
): void {
  if (!cb) return;
  source.addEventListener(name, (ev: MessageEvent) => {
    try {
      cb(JSON.parse(ev.data) as T);
    } catch { /* see fn-doc */ }
  });
}

/**
 * Resolve with the first `accountsChanged` payload on the given stream, or
 * reject on timeout / abort. Cleans up its own listener + timer on every
 * exit path so callers can safely reuse or close the stream.
 */
export function waitForAccountsChanged(
  source: EventSource,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<AccountsChangedEvent[]> {
  return new Promise<AccountsChangedEvent[]>((resolve, reject) => {
    const cleanup = () => {
      source.removeEventListener('accountsChanged', onEvent);
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const onEvent = (ev: MessageEvent) => {
      cleanup();
      try {
        resolve(JSON.parse(ev.data) as AccountsChangedEvent[]);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Failed to parse accountsChanged'));
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Operation aborted'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for accountsChanged'));
    }, timeoutMs);
    source.addEventListener('accountsChanged', onEvent);
    if (abortSignal) {
      if (abortSignal.aborted) {
        cleanup();
        reject(new Error('Operation aborted'));
        return;
      }
      abortSignal.addEventListener('abort', onAbort);
    }
  });
}
