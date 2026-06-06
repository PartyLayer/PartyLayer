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
