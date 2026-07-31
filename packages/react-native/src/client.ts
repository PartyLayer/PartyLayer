/**
 * Headless React Native client factory.
 *
 * Wires the framework-agnostic core (through the sdk's `createPartyLayer`) with the
 * React Native platform pieces, so a dApp gets a working connect and session flow with
 * no UI from us. It delegates to the sdk factory rather than inventing a parallel
 * architecture: it only wires session storage from AsyncStorage when the caller passes
 * it. Everything else, including which adapters are registered and how each one reaches
 * its wallet, follows the sdk client.
 */
import { createPartyLayer, type PartyLayerConfig, type PartyLayerClient } from '@partylayer/sdk';
import { createAsyncStorageAdapter } from './storage';
import type { RNAsyncStorage } from './types';

/** Config for the React Native client: the sdk config plus optional AsyncStorage injection. */
export interface ReactNativeClientConfig extends PartyLayerConfig {
  /**
   * AsyncStorage module for session persistence. Pass
   * `import AsyncStorage from '@react-native-async-storage/async-storage'`. When omitted
   * (and no `storage` is set), the sdk's own default storage is used, so the client never
   * forces the optional AsyncStorage peer.
   */
  asyncStorage?: RNAsyncStorage;
}

/**
 * Create a headless PartyLayer client configured for React Native.
 *
 * Session storage is AsyncStorage when `asyncStorage` is passed, else the caller's
 * `storage`, else the sdk default. Everything else follows the sdk client.
 */
export function createReactNativeClient(config: ReactNativeClientConfig): PartyLayerClient {
  const { asyncStorage, storage, ...rest } = config;
  const resolvedStorage = storage ?? (asyncStorage ? createAsyncStorageAdapter(asyncStorage) : undefined);
  return createPartyLayer({ ...rest, ...(resolvedStorage ? { storage: resolvedStorage } : {}) });
}
