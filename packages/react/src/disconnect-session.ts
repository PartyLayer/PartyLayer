import type { PartyLayerClient } from '@partylayer/sdk';
import type { SessionStore } from '@partylayer/session';

/** Keep explicit intent, provider teardown and opt-in tab synchronization together. */
export async function disconnectSession(
  client: Pick<PartyLayerClient, 'disconnect'>,
  store: SessionStore | null,
): Promise<void> {
  if (!store) return client.disconnect();
  await store.disconnect();
  // SessionStore records provider errors in state; React's async disconnect
  // hooks retain their existing rejection contract for callers/onError.
  const error = store.getSnapshot().lastError;
  if (error) throw error;
}
