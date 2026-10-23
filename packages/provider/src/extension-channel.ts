/**
 * Extension target-channel CIP-0103 provider.
 *
 * Builds a working CIP-0103 provider for a wallet discovered via
 * `canton:announceProvider` (see discovery.ts). Announce wallets route requests
 * over the splice-wallet postMessage protocol — the dApp posts a
 * `SPLICE_WALLET_REQUEST` on `window` and the extension replies with a
 * `SPLICE_WALLET_RESPONSE`, correlated by JSON-RPC id and routed by `target`.
 *
 * This is a self-contained, dependency-free implementation of that wire
 * protocol. We deliberately do NOT depend on `@canton-network/dapp-sdk`'s
 * `ExtensionAdapter`: its single bundled entry statically imports
 * `@walletconnect/sign-client` (an optional peer used only by its
 * WalletConnectAdapter), which is not installed and breaks every downstream
 * webpack/Next build that pulls `@partylayer/provider` into its graph
 * (confirmed against the live demo's `next build`). The protocol constants and
 * message shapes below mirror `@canton-network/core-types` (`WalletEvent`,
 * `SpliceMessage`) verbatim, so behaviour matches the official adapter.
 */

import type {
  CIP0103Provider,
  CIP0103RequestPayload,
} from '@partylayer/core';
import { CIP0103EventBus } from './event-bus';
import { ProviderRpcError, JSON_RPC_ERRORS, RPC_ERRORS } from './errors';

// ─── Splice wallet postMessage protocol (mirrors @canton-network/core-types) ──

const SPLICE_WALLET_REQUEST = 'SPLICE_WALLET_REQUEST';
const SPLICE_WALLET_RESPONSE = 'SPLICE_WALLET_RESPONSE';

interface SpliceResponseMessage {
  type: typeof SPLICE_WALLET_RESPONSE;
  response: {
    jsonrpc: '2.0';
    id?: string | number | null;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
  };
}

export interface ExtensionChannelOptions {
  /** Routing key (announce `target`) included on every request message. */
  target?: string;
  /** Per-request timeout in ms. Default 30000. */
  timeoutMs?: number;
}

export interface ExtensionChannelProvider extends CIP0103Provider {
  /** Remove the channel listener, reject pending RPCs and release subscriptions. */
  destroy(): void;
}

let channelSeq = 0;

/**
 * Create a CIP-0103 provider that talks the splice-wallet postMessage protocol
 * over the page `window`, routed by `target`.
 */
export function createExtensionChannelProvider(
  options: ExtensionChannelOptions = {},
): ExtensionChannelProvider {
  const target = options.target;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const eventBus = new CIP0103EventBus();
  // Unique per-provider prefix so concurrent providers never match each other's
  // responses on the shared window message bus.
  const channelId = `pl-${++channelSeq}-${target ?? 'ext'}`;
  let requestSeq = 0;
  let listening = false;
  let destroyed = false;
  const subscribedEvents = new Set<string>();

  function listen(): void {
    if (!listening && typeof window !== 'undefined') {
      window.addEventListener('message', onMessage as EventListener);
      listening = true;
    }
  }

  function detachIfIdle(): void {
    if (pending.size > 0 || [...subscribedEvents].some(name => eventBus.listenerCount(name) > 0)) return;
    if (listening && typeof window !== 'undefined') window.removeEventListener('message', onMessage as EventListener);
    listening = false;
  }

  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  function onMessage(event: MessageEvent): void {
    // Only accept responses posted on the page's OWN window by the content
    // script — never cross-window or cross-origin messages.
    if (event.source !== window) return;
    const selfOrigin =
      typeof window !== 'undefined' ? window.location?.origin : undefined;
    if (selfOrigin && selfOrigin !== 'null' && event.origin !== selfOrigin) return;

    const notification = event.data as { type?: string; target?: string; request?: { id?: unknown; jsonrpc?: string; method?: string; params?: unknown } } | undefined;
    if (notification?.type === SPLICE_WALLET_REQUEST && notification.request?.jsonrpc === '2.0' &&
        notification.request.id == null && (!target || notification.target === target)) {
      const method = notification.request.method;
      if (method && ['statusChanged', 'accountsChanged', 'txChanged', 'connected'].includes(method)) {
        eventBus.emit(method, notification.request.params);
      }
      return;
    }
    const data = event.data as Partial<SpliceResponseMessage> | undefined;
    if (!data || data.type !== SPLICE_WALLET_RESPONSE || !data.response) return;
    const { id, result, error } = data.response;
    if (id === undefined || id === null) return;
    const entry = pending.get(String(id));
    if (!entry) return; // not ours (different provider / stale)
    pending.delete(String(id));
    clearTimeout(entry.timer);
    detachIfIdle();
    if (error) {
      entry.reject(
        new ProviderRpcError(
          error.message || 'Wallet request failed',
          typeof error.code === 'number' ? error.code : JSON_RPC_ERRORS.INTERNAL_ERROR,
          error.data,
        ),
      );
    } else {
      entry.resolve(result);
    }
  }

  function postTargetOrigin(): string {
    const origin = typeof window !== 'undefined' ? window.location?.origin : undefined;
    return origin && origin !== 'null' ? origin : '*';
  }

  const provider: ExtensionChannelProvider = {
    request<T>(args: CIP0103RequestPayload): Promise<T> {
      if (destroyed) return Promise.reject(new ProviderRpcError('Extension channel was destroyed', RPC_ERRORS.DISCONNECTED));
      if (typeof window === 'undefined') {
        return Promise.reject(
          new ProviderRpcError('No window: extension channel unavailable', JSON_RPC_ERRORS.INTERNAL_ERROR),
        );
      }
      listen();
      const id = `${channelId}-${++requestSeq}`;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          detachIfIdle();
          reject(
            new ProviderRpcError(
              `Wallet request "${args.method}" timed out after ${timeoutMs}ms`,
              JSON_RPC_ERRORS.INTERNAL_ERROR,
            ),
          );
        }, timeoutMs);
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });

        const message = {
          type: SPLICE_WALLET_REQUEST,
          request: {
            jsonrpc: '2.0' as const,
            id,
            method: args.method,
            ...(args.params !== undefined ? { params: args.params } : {}),
          },
          ...(target ? { target } : {}),
        };
        try { window.postMessage(message, postTargetOrigin()); }
        catch (error) {
          pending.delete(id); clearTimeout(timer); detachIfIdle(); reject(error);
        }
      });
    },
    on(event, listener) {
      if (destroyed) return provider;
      eventBus.on(event, listener);
      subscribedEvents.add(event);
      listen();
      return provider;
    },
    emit(event, ...args) {
      return eventBus.emit(event, ...args);
    },
    removeListener(event, listener) {
      eventBus.removeListener(event, listener);
      detachIfIdle();
      return provider;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      eventBus.removeAllListeners();
      subscribedEvents.clear();
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new ProviderRpcError('Extension channel was destroyed', RPC_ERRORS.DISCONNECTED));
      }
      pending.clear();
      detachIfIdle();
    },
  };

  eventBus.setOwner(provider);
  return provider;
}
