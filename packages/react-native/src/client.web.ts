/** React Native Web retains the browser SDK's wallet catalog and configuration. */
import { createPartyLayer, PartyLayerClient, type PartyLayerConfig } from '@partylayer/sdk';
import { createAsyncStorageAdapter } from './storage';
import type { RNAsyncStorage } from './types';
export { PartyLayerClient };
export interface ReactNativeClientConfig extends PartyLayerConfig { asyncStorage?: RNAsyncStorage }
export function createReactNativeClient(config: ReactNativeClientConfig): PartyLayerClient {
  const { asyncStorage, storage, ...rest } = config;
  const resolvedStorage = storage ?? (asyncStorage ? createAsyncStorageAdapter(asyncStorage) : undefined);
  return createPartyLayer({ ...rest, ...(resolvedStorage ? { storage: resolvedStorage } : {}) });
}
