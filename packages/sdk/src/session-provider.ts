import type { CIP0103Provider } from '@partylayer/core';
import { CIP0103EventBus, toProviderRpcError } from '@partylayer/provider';

interface SessionProviderOptions {
  bridge: CIP0103Provider;
  native: () => CIP0103Provider | null;
  ensureSession: () => Promise<unknown>;
  guardNetwork: () => void;
  subscribe: (changed: () => void) => () => void;
}

/** Stable public facade: native account/ledger responses retain their real shape. */
export function createSessionProvider(options: SessionProviderOptions): {
  provider: CIP0103Provider;
  destroy: () => void;
} {
  const events = new CIP0103EventBus();
  let current: CIP0103Provider | null = null;
  let disposed = false;
  let revision = 0;
  const nativeSubscriptions: (() => void)[] = [];
  const bridgeSubscriptions: (() => void)[] = [];

  const provider: CIP0103Provider = {
    request: async <T>(args: Parameters<CIP0103Provider['request']>[0]): Promise<T> => {
      try {
        if (disposed) throw new Error('PartyLayer client was destroyed');
        // Lifecycle stays at the kit boundary. Message signing keeps its reviewed
        // encoding/normalization policy (including Console's declared encoding).
        if (
          args.method === 'connect' ||
          args.method === 'disconnect' ||
          args.method === 'signMessage'
        ) {
          return options.bridge.request<T>(args);
        }
        await options.ensureSession();
        const native = options.native();
        if (!native) return options.bridge.request<T>(args);
        if (
          [
            'prepareExecute',
            'prepareExecuteAndWait',
            'prepareTransaction',
            'executeTransaction',
            'signTransaction',
            'ledgerApi',
          ].includes(args.method)
        )
          options.guardNetwork();
        return await native.request<T>(args);
      } catch (error) {
        throw toProviderRpcError(error);
      }
    },
    on: (event, listener) => {
      events.on(event, listener);
      return provider;
    },
    emit: (event, ...args) => events.emit(event, ...args),
    removeListener: (event, listener) => {
      events.removeListener(event, listener);
      return provider;
    },
  };
  events.setOwner(provider);

  const refresh = () => {
    const next = options.native();
    if (next === current) return;
    ++revision;
    nativeSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    current = next;
    if (!next || disposed) return;
    const captured = revision;
    for (const name of ['statusChanged', 'accountsChanged', 'txChanged', 'connected']) {
      const listener = (...args: unknown[]) => {
        if (!disposed && next === options.native()) events.emit(name, ...args);
      };
      next.on(name, listener);
      nativeSubscriptions.push(() => next.removeListener(name, listener));
    }
    // Initial account/status reads are live wallet responses. Failed optional
    // methods do not turn one cached party into an invented full account list.
    for (const [method, event] of [
      ['status', 'statusChanged'],
      ['listAccounts', 'accountsChanged'],
    ] as const) {
      void next.request({ method }).then(
        (value) => {
          if (!disposed && captured === revision && next === options.native())
            events.emit(event, value);
        },
        () => {}
      );
    }
    events.emit('connected', { isConnected: true });
  };

  for (const name of ['statusChanged', 'accountsChanged', 'txChanged', 'connected']) {
    const listener = (...args: unknown[]) => {
      if (!options.native() && !disposed) events.emit(name, ...args);
    };
    options.bridge.on(name, listener);
    bridgeSubscriptions.push(() => options.bridge.removeListener(name, listener));
  }
  const unsubscribe = options.subscribe(refresh);
  refresh();
  return {
    provider,
    destroy: () => {
      if (disposed) return;
      disposed = true;
      ++revision;
      unsubscribe();
      nativeSubscriptions.splice(0).forEach((remove) => remove());
      bridgeSubscriptions.splice(0).forEach((remove) => remove());
      current = null;
      events.removeAllListeners();
    },
  };
}
