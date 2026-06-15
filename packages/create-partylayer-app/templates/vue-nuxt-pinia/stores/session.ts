import { defineStore } from 'pinia';
import { useSession, useAccount } from '@partylayer/vue';

/**
 * Pinia store surfacing the PartyLayer session — the idiomatic
 * "PartyLayer + Pinia" pattern. Components read THIS store instead of the
 * composables directly. The composables are SSR-safe (with no provided store
 * they report a disconnected session), so this store is safe during SSR too;
 * the live state comes in on the client once the plugin provides the store.
 */
export const useSessionStore = defineStore('partylayer-session', () => {
  const { status, isConnected, isConnecting, connect, disconnect } = useSession();
  const { party, networkId } = useAccount();

  return { status, isConnected, isConnecting, party, networkId, connect, disconnect };
});
