/**
 * Session-LOCAL test mocks (private; never published, test-only).
 *
 * A minimal CIP-0103 mock provider + transaction-lifecycle helper covering
 * exactly what the session store's tests need. This deliberately does NOT import
 * `@partylayer/testing` — `@partylayer/session` must not depend on a package that
 * depends back on it (that workspace cycle breaks topological build order and
 * the changesets release graph). `@partylayer/testing`'s richer harness imports
 * session; the dependency goes one way only.
 */
import {
  CIP0103_EVENTS,
  type CIP0103Account,
  type CIP0103Provider,
  type CIP0103StatusEvent,
  type CIP0103TxChangedEvent,
} from '@partylayer/core';

const DEFAULT_PARTY = 'party::mock-1';
const DEFAULT_NETWORK = 'canton:da-devnet';
const PROVIDER_META = { id: 'mock', version: '0', providerType: 'browser' as const };

function mockAccount(partyId: string, networkId: string): CIP0103Account {
  return {
    primary: true,
    partyId,
    status: 'allocated',
    hint: '',
    publicKey: '',
    namespace: '',
    networkId,
    signingProviderId: '',
  };
}

export interface MockWalletConfig {
  /** Whether `status()` reports connected before `connect()` (for restore tests). */
  connected?: boolean;
  /** Per-method artificial delay (ms) — `setTimeout`, fake-timer friendly. */
  delays?: { connect?: number };
  /** Per-method failure scenario; only `connect` is needed by session tests. */
  scenarios?: { connect?: 'userRejected' };
}

const SCENARIO_ERRORS: Record<string, () => Error> = {
  userRejected: () => new Error('User rejected the request'),
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A CIP-0103-shaped mock provider. `connect` emits `statusChanged` +
 * `accountsChanged` (like a real bridge), so the session store populates its
 * account/network; `status`/`listAccounts`/`getActiveNetwork` answer per config.
 */
export function createMockWallet(config: MockWalletConfig = {}): CIP0103Provider {
  const networkId = DEFAULT_NETWORK;
  const account = mockAccount(DEFAULT_PARTY, networkId);
  let connected = config.connected ?? false;
  const bus = new Map<string, Set<(...args: unknown[]) => void>>();
  const fire = (event: string, ...args: unknown[]) =>
    bus.get(event)?.forEach((fn) => fn(...args));

  const provider: CIP0103Provider = {
    async request<T>(args: { method: string }): Promise<T> {
      switch (args.method) {
        case 'connect': {
          const delay = config.delays?.connect;
          if (delay && delay > 0) await wait(delay);
          const scenario = config.scenarios?.connect;
          if (scenario) throw SCENARIO_ERRORS[scenario]();
          connected = true;
          fire(CIP0103_EVENTS.STATUS_CHANGED, {
            connection: { isConnected: true },
            provider: PROVIDER_META,
            network: { networkId },
          } as CIP0103StatusEvent);
          fire(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account]);
          return { isConnected: true } as T;
        }
        case 'disconnect':
          connected = false;
          fire(CIP0103_EVENTS.STATUS_CHANGED, {
            connection: { isConnected: false },
            provider: PROVIDER_META,
          } as CIP0103StatusEvent);
          return null as T;
        case 'status':
          return {
            connection: { isConnected: connected },
            provider: PROVIDER_META,
            network: { networkId },
          } as T;
        case 'listAccounts':
          return [account] as T;
        case 'getActiveNetwork':
          return { networkId } as T;
        default:
          return undefined as T;
      }
    },
    on(event, listener) {
      let set = bus.get(event);
      if (!set) {
        set = new Set();
        bus.set(event, set);
      }
      set.add(listener as (...args: unknown[]) => void);
      return provider;
    },
    emit(event, ...args) {
      fire(event, ...args);
      return true;
    },
    removeListener(event, listener) {
      bus.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
  };
  return provider;
}

/** Records `txChanged` events emitted on a provider (order-preserving). */
export function recordTxEvents(provider: CIP0103Provider): {
  statuses(): CIP0103TxChangedEvent['status'][];
  stop(): void;
} {
  const events: CIP0103TxChangedEvent[] = [];
  const listener = (event: CIP0103TxChangedEvent) => events.push(event);
  provider.on(CIP0103_EVENTS.TX_CHANGED, listener);
  return {
    statuses: () => events.map((e) => e.status),
    stop: () => provider.removeListener(CIP0103_EVENTS.TX_CHANGED, listener),
  };
}

/**
 * Minimal manual transaction lifecycle: each `advance()` emits the next
 * CIP-0103 `txChanged` status (preparing→pending, submitting→signed,
 * confirming→[no event], finalized→executed) on the provider.
 */
export function createTransactionLifecycle(opts: {
  provider: CIP0103Provider;
  commandId: string;
}): { advance(): void } {
  // CIP-0103 statuses per phase; `confirming` emits nothing (no such status).
  const emissions: (CIP0103TxChangedEvent['status'] | null)[] = [
    'pending', // preparing
    'signed', // submitting
    null, // confirming (no CIP-0103 status)
    'executed', // finalized
  ];
  let step = 0;
  return {
    advance() {
      const status = emissions[step];
      step += 1;
      if (status == null) return;
      (opts.provider as { emit(event: string, ...args: unknown[]): boolean }).emit(
        CIP0103_EVENTS.TX_CHANGED,
        { type: 'txChanged', commandId: opts.commandId, status } as CIP0103TxChangedEvent,
      );
    },
  };
}
