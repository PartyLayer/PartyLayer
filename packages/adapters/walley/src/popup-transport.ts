/**
 * Popup JSON-RPC transport for the Walley web wallet. Opens a centred popup,
 * waits for its `{ ready: true }`, then exchanges one origin-checked JSON-RPC
 * 2.0 request/response over `postMessage`. A popup closed early is a rejection.
 */

import { UserRejectedError } from '@partylayer/core';

import { WALLEY_WALLET_ID } from './constants';
import { WalleyPopupBlockedError } from './errors';

const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 650;
const CLOSE_POLL_MS = 500;

/** EIP-1193 userRejectedRequest — the code Walley emits when a user declines. */
const EIP1193_USER_REJECTED = 4001;

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let nextRequestId = 1;

export interface PopupSendOptions {
  /** Reject after this many ms if the user has not completed the flow. */
  timeoutMs?: number;
  /** Abort the flow (closes the popup, rejects the promise). */
  signal?: AbortSignal;
}

export class WalleyPopupTransport {
  constructor(private readonly host: string) {}

  send<T>(
    path: string,
    method: string,
    params?: unknown,
    options?: PopupSendOptions,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (typeof window === 'undefined' || typeof window.open !== 'function') {
        reject(new WalleyPopupBlockedError(this.host));
        return;
      }

      const url = `${this.host}${path}`;
      const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
      const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=true`;

      const popup = window.open(url, `walley-${method}`, features);
      if (!popup) {
        reject(new WalleyPopupBlockedError(this.host));
        return;
      }

      const requestId = nextRequestId++;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== this.host) return;
        const data = event.data as { ready?: boolean } & Partial<JsonRpcResponse>;

        // Page is mounted and listening — send the request.
        if (data?.ready === true) {
          try {
            popup.postMessage({ jsonrpc: '2.0', id: requestId, method, params }, this.host);
          } catch (err) {
            finish(() => reject(err));
          }
          return;
        }

        // JSON-RPC response for our request.
        if (data?.jsonrpc === '2.0' && data.id === requestId) {
          if (data.error) {
            const err = data.error;
            // Walley signals a decline two ways: the EIP-1193 userRejectedRequest
            // code, or its Cancel button — which closes the popup as it rejects.
            const declined = err.code === EIP1193_USER_REJECTED || popup.closed;
            finish(() =>
              reject(
                declined
                  ? new UserRejectedError(method, { walletId: WALLEY_WALLET_ID })
                  : Object.assign(new Error(err.message || 'Walley request failed'), {
                      code: err.code,
                      data: err.data,
                    }),
              ),
            );
          } else {
            finish(() => resolve(data.result as T));
          }
        }
      };

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new UserRejectedError(method, { walletId: WALLEY_WALLET_ID })));
        }
      }, CLOSE_POLL_MS);

      const timeoutTimer = options?.timeoutMs
        ? setTimeout(() => {
            finish(() => reject(new Error('Walley request timed out')));
          }, options.timeoutMs)
        : undefined;

      const onAbort = () => finish(() => reject(new UserRejectedError(method, { walletId: WALLEY_WALLET_ID })));

      const cleanup = () => {
        window.removeEventListener('message', messageHandler);
        clearInterval(pollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        options?.signal?.removeEventListener('abort', onAbort);
        try {
          if (!popup.closed) popup.close();
        } catch {
          /* cross-origin close guard — ignore */
        }
      };

      if (options?.signal) {
        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener('abort', onAbort);
      }

      window.addEventListener('message', messageHandler);
    });
  }
}
