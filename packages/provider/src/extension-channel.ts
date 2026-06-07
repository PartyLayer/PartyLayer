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
import { ProviderRpcError, JSON_RPC_ERRORS } from './errors';

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

let channelSeq = 0;

/**
 * Create a CIP-0103 provider that talks the splice-wallet postMessage protocol
 * over the page `window`, routed by `target`.
 */
export function createExtensionChannelProvider(
  options: ExtensionChannelOptions = {},
): CIP0103Provider {
  const target = options.target;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const eventBus = new CIP0103EventBus();
  // Unique per-provider prefix so concurrent providers never match each other's
  // responses on the shared window message bus.
  const channelId = `pl-${++channelSeq}-${target ?? 'ext'}`;
  let requestSeq = 0;

  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  function onMessage(event: MessageEvent): void {
    const data = event.data as Partial<SpliceResponseMessage> | undefined;
    if (!data || data.type !== SPLICE_WALLET_RESPONSE || !data.response) return;
    const { id, result, error } = data.response;
    if (id === undefined || id === null) return;
    const entry = pending.get(String(id));
    if (!entry) return; // not ours (different provider / stale)
    pending.delete(String(id));
    clearTimeout(entry.timer);
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

  if (typeof window !== 'undefined') {
    window.addEventListener('message', onMessage as EventListener);
  }

  function postTargetOrigin(): string {
    const origin = typeof window !== 'undefined' ? window.location?.origin : undefined;
    return origin && origin !== 'null' ? origin : '*';
  }

  const provider: CIP0103Provider = {
    request<T>(args: CIP0103RequestPayload): Promise<T> {
      if (typeof window === 'undefined') {
        return Promise.reject(
          new ProviderRpcError('No window: extension channel unavailable', JSON_RPC_ERRORS.INTERNAL_ERROR),
        );
      }
      const id = `${channelId}-${++requestSeq}`;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
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
        window.postMessage(message, postTargetOrigin());
      });
    },
    on(event, listener) {
      eventBus.on(event, listener);
      return provider;
    },
    emit(event, ...args) {
      return eventBus.emit(event, ...args);
    },
    removeListener(event, listener) {
      eventBus.removeListener(event, listener);
      return provider;
    },
  };

  eventBus.setOwner(provider);
  return provider;
}
