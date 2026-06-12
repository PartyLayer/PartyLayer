/**
 * Offline test helpers.
 *
 * These let unit/integration tests run with NO DevNet / live-wallet
 * dependency. Everything is deterministic and fake-timer friendly: the mock
 * wallet and lifecycle use `setTimeout` only for optional configured delays,
 * so `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` fully control time.
 *
 * See ./__tests__/offline-example.test.ts for a full connect → submit →
 * finalize assertion against the mock with zero network access.
 */

import { CIP0103_EVENTS } from '@partylayer/core';
import type { CIP0103Provider, CIP0103TxChangedEvent } from '@partylayer/core';
import {
  createSessionStore,
  createMemoryStorage,
  type SessionStore,
  type SessionStoreOptions,
} from '@partylayer/session';
import { createMockWallet, type MockWalletConfig } from './mock-wallet';

export interface TxEventRecorder {
  /** All `txChanged` events captured, in emission order. */
  readonly events: CIP0103TxChangedEvent[];
  /** Just the `status` field of each captured event, in order. */
  statuses(): CIP0103TxChangedEvent['status'][];
  /** Stop recording (removes the listener). */
  stop(): void;
}

/**
 * Subscribe to a provider's `txChanged` stream and collect every event.
 * Returns a recorder whose `events` array fills as events fire.
 */
export function recordTxEvents(provider: CIP0103Provider): TxEventRecorder {
  const events: CIP0103TxChangedEvent[] = [];
  const listener = (event: CIP0103TxChangedEvent): void => {
    events.push(event);
  };
  provider.on(CIP0103_EVENTS.TX_CHANGED, listener);
  return {
    events,
    statuses() {
      return events.map((e) => e.status);
    },
    stop() {
      provider.removeListener(CIP0103_EVENTS.TX_CHANGED, listener);
    },
  };
}

/**
 * Convenience: connect a mock provider via the CIP-0103 `connect` method.
 * Returns the `CIP0103ConnectResult`-shaped response.
 */
export async function connectMock(
  provider: CIP0103Provider,
): Promise<{ isConnected: boolean }> {
  return provider.request<{ isConnected: boolean }>({ method: 'connect' });
}

/** A fully offline mock wallet + session store, wired together. */
export interface OfflineHarness {
  readonly provider: CIP0103Provider;
  readonly store: SessionStore;
  destroy(): void;
}

/**
 * Compose a mock CIP-0103 wallet and a real `@partylayer/session` store with NO
 * network/DevNet. `wallet` configures the mock (failure scenarios, delays,
 * party); `session` overrides store options (storage defaults to in-memory).
 * For TanStack Query-inclusive composition, see `@partylayer/testing/query`.
 */
export function createOfflineHarness(
  config: { wallet?: MockWalletConfig; session?: Partial<SessionStoreOptions> } = {},
): OfflineHarness {
  const provider = createMockWallet(config.wallet);
  const store = createSessionStore(provider, {
    storage: createMemoryStorage(),
    ...config.session,
  });
  return {
    provider,
    store,
    destroy() {
      store.destroy();
    },
  };
}
