/**
 * Headless React Native client factory.
 *
 * Wires the framework-agnostic core (through the sdk's `createPartyLayer`) with the
 * React Native platform pieces, so a dApp gets a working connect and session flow with
 * no UI from us. It delegates to the sdk factory rather than inventing a parallel
 * architecture: it only defaults storage to AsyncStorage so sessions persist on the
 * device. Deep link wallets use {@link createReactNativeDeepLinkPlatform} for their
 * transport.
 */
import { createPartyLayer, type PartyLayerConfig, type PartyLayerClient } from '@partylayer/sdk';
import { createAsyncStorageAdapter } from './storage';
import type { RNAsyncStorage } from './types';

/** Config for the React Native client: the sdk config plus optional AsyncStorage injection. */
export interface ReactNativeClientConfig extends PartyLayerConfig {
  /**
   * AsyncStorage module for session persistence. When omitted, the sdk's own `storage`
   * is used if provided, otherwise AsyncStorage is loaded from the peer dependency.
   */
  asyncStorage?: RNAsyncStorage;
}

/**
 * Create a headless PartyLayer client configured for React Native.
 *
 * Defaults session storage to AsyncStorage (unless the caller supplies its own
 * `storage`). Everything else follows the sdk client.
 */
export function createReactNativeClient(config: ReactNativeClientConfig): PartyLayerClient {
  const { asyncStorage, storage, ...rest } = config;
  const resolvedStorage = storage ?? createAsyncStorageAdapter(asyncStorage);
  return createPartyLayer({ ...rest, storage: resolvedStorage });
}
